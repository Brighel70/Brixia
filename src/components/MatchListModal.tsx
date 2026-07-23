import React, { useState, useEffect } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getPositionDisplayName } from '@/utils/personUtils';
import { readCategoryIds, expandCategoryFilterIds, loadPlayersForCategories } from '@/lib/categoryMemberships';
import { formatDisplayPersonName } from '@/lib/formatPersonName';
import { GOLEE } from '@/config/goleeTheme';
// Tabella dei ruoli del rugby
const RUGBY_ROLES: { [key: number]: string } = {
  1: 'Pilone SX',
  2: 'Tallonatore',
  3: 'Pilone DX',
  4: '2^ Linea',
  5: '2^ Linea',
  6: 'Flanker',
  7: 'Flanker',
  8: 'Terza Centro',
  9: 'Mediano',
  10: 'Apertura',
  11: 'Ala',
  12: '1° Centro',
  13: '2° Centro',
  14: 'Ala',
  15: 'Estremo'
};

// Funzione per ottenere il ruolo dal numero
const getRoleFromNumber = (number: number): string => {
  return RUGBY_ROLES[number] || '(a disposizione)';
};

interface Player {
  id: string;
  full_name: string;
  roleLabel: string;
  injured?: boolean;
  isDisqualified?: boolean;
  isMarkedInjured?: boolean;
}

interface MatchList {
  id: string;
  name: string;
  type: 'match' | 'friendly' | 'training';
  event_id: string | null;
  selected_players: { player_id: string; number: number }[];
  created_by: string | null;
  created_at: string;
  updated_at?: string;
  events?: {
    title: string;
    event_date: string;
  };
}

interface MatchListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedPlayers: { player_id: string; number: number }[], listName: string, listType: 'match' | 'friendly' | 'training', eventId?: string) => void;
  categoryId: string;
  editingList?: MatchList | null;
  initialEventId?: string | null;
  isChampionship?: boolean;
  matchTitle?: string;
  matchDate?: string;
}

interface NextMatch {
  id: string;
  title: string;
  event_date: string;
  is_championship?: boolean;
}

const MatchListModal: React.FC<MatchListModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  categoryId,
  editingList,
  initialEventId,
  isChampionship = false,
  matchTitle,
  matchDate,
}) => {
  const [step, setStep] = useState<'type' | 'players' | 'confirm'>('type');
  const [listType, setListType] = useState<'match' | 'friendly' | 'training' | null>(null);
  const [listName, setListName] = useState('');
  const [customName, setCustomName] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<{ player_id: string; number: number }[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [showInjuryWarning, setShowInjuryWarning] = useState<Player | null>(null);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [showCompleteListPrompt, setShowCompleteListPrompt] = useState(false);
  const [allowExtraPlayers, setAllowExtraPlayers] = useState(false);

  const isChampionshipMatch = isChampionship || nextMatch?.is_championship === true;
  const startersCount = selectedPlayers.filter((player) => player.number <= 15).length;
  const benchCount = selectedPlayers.filter((player) => player.number > 15).length;

  const linkedMatchTitle =
    matchTitle?.trim() ||
    listName?.trim() ||
    nextMatch?.title?.trim() ||
    editingList?.events?.title?.trim() ||
    '';

  const linkedMatchDate = matchDate || nextMatch?.event_date || editingList?.events?.event_date;
  const linkedMatchDateLabel = linkedMatchDate
    ? new Date(linkedMatchDate).toLocaleDateString('it-IT', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  useEffect(() => {
    if (isOpen && categoryId) {
      if (initialEventId) {
        // Se c'è un eventId iniziale, carica i dati della partita
        supabase
          .from('events')
          .select('*')
          .eq('id', initialEventId)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              setNextMatch(data);
              if (!editingList) {
                setListType('match');
                setListName(data.title || '');
                setStep('players');
              }
            }
          });
      } else {
        loadNextMatch();
      }
      loadPlayers();
      
      if (editingList) {
        setListName(editingList.name);
        setListType(editingList.type);
        setSelectedPlayers(editingList.selected_players || []);
        setStep('players');
      } else {
        resetForm();
      }
    }
  }, [isOpen, categoryId, editingList, initialEventId]);

  const resetForm = () => {
    setStep('type');
    setListType(null);
    setListName('');
    setCustomName('');
    setSelectedPlayers([]);
    setNextMatch(null);
    setPlayerSearch('');
    setShowInjuryWarning(null);
    setShowLimitWarning(false);
    setShowCompleteListPrompt(false);
    setAllowExtraPlayers(false);
  };

  const loadNextMatch = async () => {
    try {
      console.log('🔍 Loading next match for category:', categoryId);
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('category_id', categoryId)
        .order('event_date', { ascending: true });

      console.log('🔍 All events for category:', data);

      // Filtra partite di oggi o future (confronto per data, non per ora)
      const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const todayOrFutureMatches = (data || []).filter((event: any) => {
        const isMatch = event.event_type === 'match' || event.event_type === 'partita';
        const eventDateStr = (event.event_date || '').toString().slice(0, 10);
        const isTodayOrFuture = eventDateStr >= todayStr;
        return isMatch && isTodayOrFuture;
      });

      const firstMatch = todayOrFutureMatches.length > 0 ? todayOrFutureMatches[0] : null;

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading next match:', error);
      } else if (firstMatch) {
        setNextMatch(firstMatch);
        console.log('✅ Next match found:', firstMatch);
      } else {
        console.log('⚠️ No next match found for this category');
      }
    } catch (error) {
      console.error('Error loading next match:', error);
    }
  };

  const loadPlayers = async () => {
    try {
      setLoading(true);

      if (!categoryId) {
        setPlayers([]);
        return;
      }

      // Carica categorie per gestire Seniores (Serie B + Serie C)
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, code, name');
      const categories = categoriesData || [];

      // Use centralized expandCategoryFilterIds
      const categoryIdsToMatch = expandCategoryFilterIds(categoryId, categories);

      // Carica ruoli giocatore dalla tabella player_positions
      const { data: positionsData } = await supabase
        .from('player_positions')
        .select('id, name')
        .order('position_order');
      const positionsMap = Object.fromEntries(
        (positionsData || []).map((position: { id: string; name: string }) => [position.id, position.name])
      );

      const getPlayerPositionIds = (playerPositions: unknown): string[] => {
        if (!playerPositions) return [];
        if (Array.isArray(playerPositions)) return playerPositions;
        if (typeof playerPositions === 'string') {
          try {
            return JSON.parse(playerPositions) || [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const getPlayerRoleLabel = (player: {
        player_positions?: unknown;
      }) => {
        const positionIds = getPlayerPositionIds(player.player_positions);
        if (positionIds.length > 0) {
          return positionIds
            .map((id: string) => getPositionDisplayName(positionsMap[id] || ''))
            .filter(Boolean)
            .join(', ');
        }
        return '';
      };

      // Use centralized loadPlayersForCategories
      const categoryPlayers = await loadPlayersForCategories(
        categoryIdsToMatch,
        { select: 'id, full_name, player_categories, player_positions' }
      );

      // Filtra giocatori squalificati (se colonna esiste) e carica dati infortuni
      const filteredPlayers = await Promise.all(
        categoryPlayers
          .filter((player: any) => player.disqualified !== true)
          .map(async (player: any) => {
            // Carica infortuni attivi
            const { data: injuries } = await supabase
              .from('injuries')
              .select('person_id')
              .eq('person_id', player.id)
              .eq('current_status', 'In corso')
              .eq('is_closed', false);

            return {
              id: player.id,
              full_name: player.full_name,
              roleLabel: getPlayerRoleLabel(player),
              injured: player.injured === true,
              isDisqualified: player.disqualified === true,
              isMarkedInjured: player.injured === true || (injuries && injuries.length > 0)
            };
          })
      );

      // Ordina i giocatori per cognome (ultima parola del full_name)
      const sortedPlayers = filteredPlayers.sort((a, b) => {
        const getSurname = (fullName: string) => {
          const parts = fullName.trim().split(/\s+/);
          return parts.length > 0 ? parts[parts.length - 1] : fullName;
        };
        
        const surnameA = getSurname(a.full_name).toLowerCase();
        const surnameB = getSurname(b.full_name).toLowerCase();
        
        return surnameA.localeCompare(surnameB, 'it', { sensitivity: 'base' });
      });

      setPlayers(sortedPlayers);
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerToggle = (player: Player) => {
    // Se il giocatore è infortunato, mostra warning
    if (player.isMarkedInjured) {
      setShowInjuryWarning(player);
      return;
    }

    togglePlayer(player);
  };

  const togglePlayer = (player: Player) => {
    const existingIndex = selectedPlayers.findIndex(p => p.player_id === player.id);
    
    if (existingIndex >= 0) {
      const newSelected = selectedPlayers.filter(p => p.player_id !== player.id);
      setSelectedPlayers(newSelected);
      if (newSelected.length < 22) {
        setShowCompleteListPrompt(false);
      }
    } else {
      const nextNumber = getNextAvailableNumber();

      if (nextNumber > 22 && !allowExtraPlayers) {
        if (isChampionshipMatch) {
          setShowCompleteListPrompt(true);
        } else {
          setShowLimitWarning(true);
        }
        return;
      }

      const newSelected = [...selectedPlayers, { player_id: player.id, number: nextNumber }];
      setSelectedPlayers(newSelected);

      if (isChampionshipMatch && !allowExtraPlayers && newSelected.length === 22) {
        setShowCompleteListPrompt(true);
      }
    }
  };

  const getNextAvailableNumber = (): number => {
    const usedNumbers = selectedPlayers.map(p => p.number).sort((a, b) => a - b);

    for (let i = 1; i <= 22; i++) {
      if (!usedNumbers.includes(i)) {
        return i;
      }
    }

    if (allowExtraPlayers) {
      let next = 23;
      while (usedNumbers.includes(next)) {
        next += 1;
      }
      return next;
    }

    return 23;
  };

  const handleListTypeSelect = (type: 'match' | 'friendly' | 'training') => {
    setListType(type);
    
    if (type === 'match' && nextMatch) {
      setListName(nextMatch.title);
      setStep('players');
    } else {
      // Per friendly e training, va direttamente al step players ma senza listName
      // Il nome verrà chiesto nel step players
      setStep('players');
    }
  };

  const handleCustomNameSubmit = () => {
    if (customName.trim()) {
      setListName(customName.trim());
      setStep('players');
    }
  };

  const handleConfirmSelection = () => {
    if (listName && selectedPlayers.length > 0) {
      // Solo per le partite associa l'evento, per amichevoli e allenamenti non associare nessun evento
      const eventId = listType === 'match' ? (initialEventId || nextMatch?.id) : undefined;
      onConfirm(selectedPlayers, listName, listType || 'friendly', eventId);
      onClose();
    }
  };

  const handleInjuryWarningConfirm = () => {
    if (showInjuryWarning) {
      togglePlayer(showInjuryWarning);
      setShowInjuryWarning(null);
    }
  };

  const handleContinueAddingPlayers = () => {
    setShowCompleteListPrompt(false);
    setAllowExtraPlayers(true);
  };

  const handleLimitWarningConfirm = () => {
    setShowLimitWarning(false);
    if (showInjuryWarning) {
      togglePlayer(showInjuryWarning);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1220]/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-list-modal-title"
    >
      <div
        className="bg-white text-gray-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="relative rounded-t-2xl px-6 py-5 text-white"
          style={{ backgroundColor: 'var(--brand-primary, #0b1f4d)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-xl p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Chiudi"
            title="Chiudi"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="pr-10">
            <h2 id="match-list-modal-title" className="text-2xl font-bold">
              {editingList ? 'Modifica Lista Gara' : 'Crea Lista Gara'}
              {linkedMatchTitle ? `: ${linkedMatchTitle}` : ''}
            </h2>
            {linkedMatchDateLabel && (
              <p className="mt-1 text-sm text-white/75">{linkedMatchDateLabel}</p>
            )}
            {step === 'players' && (
              <p className="mt-2 text-sm font-medium text-white/90">
                Titolari: {startersCount}/15 · A disposizione: {benchCount}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Step 1: Tipo di Lista */}
          {step === 'type' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipo di Lista</h3>
              
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => handleListTypeSelect('match')}
                  className="p-4 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">🏉</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Partita</div>
                      <div className="text-sm text-gray-600">
                        {nextMatch ? `Prossima partita: ${nextMatch.title}` : 'Nessuna partita programmata'}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleListTypeSelect('friendly')}
                  className="p-4 border-2 border-yellow-200 rounded-xl hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-200 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">🤝</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Amichevole</div>
                      <div className="text-sm text-gray-600">Partita amichevole</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleListTypeSelect('training')}
                  className="p-4 border-2 border-green-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all duration-200 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">🏃</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Allenamento</div>
                      <div className="text-sm text-gray-600">Sessione di allenamento</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50"
                  style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Nome Personalizzato */}
          {step === 'players' && !listName && listType && listType !== 'match' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Nome della Lista</h3>
              
              <div>
                <p className="text-gray-600 mb-4">
                  {listType === 'friendly' && 'Inserisci il nome per la partita amichevole:'}
                  {listType === 'training' && 'Inserisci il nome per l\'allenamento:'}
                </p>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={listType === 'friendly' ? 'es. Amichevole vs Benetton' : 'es. Allenamento Tecnico'}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setStep('type')}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Indietro
                </button>
                <button
                  onClick={handleCustomNameSubmit}
                  disabled={!customName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continua
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Selezione Giocatori */}
          {step === 'players' && listName && (
            <div className="space-y-4">
              <div className="relative mb-4">
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Cerca per nome o ruolo..."
                  className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-500"
                />
                {playerSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => setPlayerSearch('')}
                    title="Cancella ricerca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-600">
                  Selezionati: {selectedPlayers.length}/22
                </p>
                {selectedPlayers.length >= 22 && !allowExtraPlayers && (
                  <span className="text-orange-600 text-sm font-medium">
                    Limite raggiunto (22 giocatori)
                  </span>
                )}
                {allowExtraPlayers && selectedPlayers.length >= 22 && (
                  <span className="text-blue-600 text-sm font-medium">
                    Lista estesa ({selectedPlayers.length} giocatori)
                  </span>
                )}
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Caricamento giocatori...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {players
                    .filter((player) => {
                      const q = playerSearch.trim().toLowerCase();
                      if (!q) return true;
                      const nameMatch = (player.full_name || '').toLowerCase().includes(q);
                      const roleMatch = (player.roleLabel || '').toLowerCase().includes(q);
                      return nameMatch || roleMatch;
                    })
                    .map((player) => {
                    const isSelected = selectedPlayers.some(p => p.player_id === player.id);
                    const playerNumber = selectedPlayers.find(p => p.player_id === player.id)?.number;
                    
                    return (
                      <div
                        key={player.id}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        } ${
                          player.isMarkedInjured
                            ? 'bg-red-100 border-red-300'
                            : ''
                        }`}
                        onClick={() => handlePlayerToggle(player)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-4 h-4 text-white" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900">{formatDisplayPersonName(player.full_name)}</div>
                              {player.isMarkedInjured && (
                                <div className="mt-1 flex items-center space-x-2">
                                  <span className="flex w-fit items-center rounded-full border border-red-200 bg-white px-2 py-1 text-xs font-medium">
                                    <span className="font-bold text-red-900">✚</span>
                                  </span>
                                  <span className="text-xs text-red-600">Infortunato</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            {player.roleLabel ? (
                              <div className="text-[15px] font-medium text-gray-600">{player.roleLabel}</div>
                            ) : null}
                            {isSelected && (
                              <div className="flex flex-col items-center justify-center">
                                <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                                  {playerNumber}
                                </div>
                                <div className="text-xs font-medium text-gray-600">
                                  {getRoleFromNumber(playerNumber || 0)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {players.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  <p>Nessun giocatore disponibile per questa categoria.</p>
                </div>
              )}

              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={() => setStep('type')}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Indietro
                </button>
                <button
                  onClick={handleConfirmSelection}
                  disabled={selectedPlayers.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingList ? 'Salva Modifiche' : 'Crea Lista'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Warning Modals */}
        {showInjuryWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Giocatore Infortunato</h3>
                <p className="text-gray-600 mb-4">
                  {formatDisplayPersonName(showInjuryWarning.full_name)} è attualmente infortunato. Vuoi comunque includerlo nella lista?
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowInjuryWarning(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleInjuryWarningConfirm}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Includi Comunque
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCompleteListPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
            <div className="bg-white text-gray-900 rounded-2xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Lista completa</h3>
                <p className="text-gray-600 mb-4">
                  Hai inserito 22 giocatori. La lista gara è completa. Vuoi salvarla o aggiungere altri giocatori?
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleContinueAddingPlayers}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Aggiungi giocatore
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSelection}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Salva lista
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showLimitWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Limite Raggiunto</h3>
                <p className="text-gray-600 mb-4">
                  Hai raggiunto il limite massimo di 22 giocatori per lista.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleLimitWarningConfirm}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchListModal;
