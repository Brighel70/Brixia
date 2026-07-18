/**
 * Validazione anti-accavallamento appuntamenti (buffer 4 min, regole giocatore/medico/macchinari)
 * Codice condiviso tra TeamFlow e FlowMe.
 */

const BUFFER_MINUTES = 4;

export type OverlapHardError = {
  type: 'player' | 'tecar' | 'laser' | 'medico';
  slot: string;
  conflictingOperator: string | null;
};

export interface OverlapResult {
  hardError: OverlapHardError | null;
  warning: {
    message: string;
    slot: string;
  } | null;
}

export function formatOverlapHardError(err: OverlapHardError, currentOperator: string): string {
  const slot = err.slot;
  const confOp = err.conflictingOperator?.trim() || '';
  const currOp = currentOperator?.trim() || '';
  const sameOp = confOp && currOp && confOp.toLowerCase() === currOp.toLowerCase();

  switch (err.type) {
    case 'player':
      if (sameOp) return `Ti stai accavallando con un tuo appuntamento per questo giocatore (${slot}). Scegli un altro orario.`;
      if (confOp) return `Il giocatore ha già un appuntamento nella fascia ${slot} con l'operatore ${confOp}. Scegli un altro orario.`;
      return `Il giocatore ha già un appuntamento nella fascia ${slot}. Scegli un altro orario.`;
    case 'tecar':
      if (sameOp) return `La Tecar è già occupata da un tuo appuntamento (${slot}). Scegli un altro orario.`;
      if (confOp) return `La Tecar è occupata dall'operatore ${confOp} nella fascia ${slot}. Scegli un altro orario.`;
      return `La Tecar è già occupata nella fascia ${slot}. Scegli un altro orario.`;
    case 'laser':
      if (sameOp) return `Il Laser è già occupato da un tuo appuntamento (${slot}). Scegli un altro orario.`;
      if (confOp) return `Il Laser è occupato dall'operatore ${confOp} nella fascia ${slot}. Scegli un altro orario.`;
      return `Il Laser è già occupato nella fascia ${slot}. Scegli un altro orario.`;
    case 'medico':
      return `Hai già un'altra visita nella fascia ${slot}. Scegli un altro orario.`;
    default:
      return `Impossibile fissare l'appuntamento nella fascia ${slot}. Scegli un altro orario.`;
  }
}

export interface OverlapActivity {
  id: string;
  person_id: string;
  injury_id: string;
  activity_type: string;
  operator_name: string | null;
  tecar: boolean;
  laser: boolean;
  activity_date: string;
  activity_time?: string | null;
  ricontrollo?: string | null;
  ricontrollo_time?: string | null;
  duration_minutes: number | null;
  buffer_minuti?: number | null;
}

function parseTimeToMinutes(timeStr: string): number {
  const parts = String(timeStr).trim().split(/[:\s]/);
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

function formatSlot(startMin: number, endMin: number): string {
  const sh = Math.floor(startMin / 60);
  const sm = startMin % 60;
  const eh = Math.floor(endMin / 60);
  const em = endMin % 60;
  return `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}-${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function getStartEndMinutes(
  dateStr: string,
  timeStr: string | null | undefined,
  duration: number,
  buffer: number = BUFFER_MINUTES
): { start: number; end: number } | null {
  if (!dateStr || !timeStr || !/^\d{1,2}:\d{2}/.test(String(timeStr))) return null;
  const startMin = parseTimeToMinutes(String(timeStr));
  const endMin = startMin + duration + buffer;
  return { start: startMin, end: endMin };
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function checkOverlap(
  newDate: string,
  newTime: string,
  newDuration: number,
  newPersonId: string,
  newActivityType: string,
  newOperator: string,
  newTecar: boolean,
  newLaser: boolean,
  existingActivities: OverlapActivity[],
  excludeId?: string | null
): OverlapResult {
  const dur = newDuration > 0 ? newDuration : 30;
  const newSlot = getStartEndMinutes(newDate, newTime, dur);
  if (!newSlot) return { hardError: null, warning: null };

  let physioWarning: { message: string; slot: string } | null = null;

  for (const ex of existingActivities) {
    if (excludeId && ex.id === excludeId) continue;
    const exDate = (ex.ricontrollo || ex.activity_date) || '';
    const exTime = ex.ricontrollo_time ?? ex.activity_time;
    if (!exDate || !exTime) continue;

    const exDur = (ex.duration_minutes && ex.duration_minutes > 0) ? ex.duration_minutes : 30;
    const exBuf = (ex.buffer_minuti != null && ex.buffer_minuti > 0) ? ex.buffer_minuti : BUFFER_MINUTES;
    const exSlot = getStartEndMinutes(exDate, String(exTime).slice(0, 5), exDur, exBuf);
    if (!exSlot) continue;

    if (newDate !== exDate) continue;
    if (!overlaps(newSlot, exSlot)) continue;

    const slotStr = formatSlot(exSlot.start, exSlot.end - 1);

    if (ex.person_id === newPersonId) {
      return {
        hardError: {
          type: 'player',
          slot: slotStr,
          conflictingOperator: ex.operator_name ? String(ex.operator_name).trim() : null,
        },
        warning: null,
      };
    }

    if (newTecar && ex.tecar) {
      return {
        hardError: {
          type: 'tecar',
          slot: slotStr,
          conflictingOperator: ex.operator_name ? String(ex.operator_name).trim() : null,
        },
        warning: null,
      };
    }
    if (newLaser && ex.laser) {
      return {
        hardError: {
          type: 'laser',
          slot: slotStr,
          conflictingOperator: ex.operator_name ? String(ex.operator_name).trim() : null,
        },
        warning: null,
      };
    }

    const isNewMed = ['medical_visit', 'Visita medica'].includes(newActivityType);
    const isExMed = ['medical_visit', 'Visita medica'].includes(ex.activity_type || '');
    if (isNewMed && isExMed && newOperator && ex.operator_name) {
      const opNew = String(newOperator).trim();
      const opEx = String(ex.operator_name).trim();
      if (opNew && opEx && opNew === opEx) {
        return {
          hardError: {
            type: 'medico',
            slot: slotStr,
            conflictingOperator: opEx,
          },
          warning: null,
        };
      }
    }

    const isNewPhysio = ['physiotherapy', 'Fisioterapia'].includes(newActivityType);
    const isExPhysio = ['physiotherapy', 'Fisioterapia'].includes(ex.activity_type || '');
    if (isNewPhysio && isExPhysio && newOperator && ex.operator_name) {
      const opNew = String(newOperator).trim();
      const opEx = String(ex.operator_name).trim();
      if (opNew && opEx && opNew === opEx) {
        physioWarning = {
          message: `Attenzione: l'operatore ${newOperator} ha già un appuntamento nella fascia ${slotStr}. Vuoi sovrapporli comunque?`,
          slot: slotStr,
        };
      }
    }
  }

  return { hardError: null, warning: physioWarning };
}
