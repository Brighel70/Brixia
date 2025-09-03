'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Item = {
  name: string;
  path: string;
  isFolder: boolean;
  signedUrl?: string;
  mime?: string;
};

const BUCKET = 'docs'; // il tuo bucket
const ACCEPT = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export default function StorageDrive() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string | null>(null);
  const [prefix, setPrefix] = useState<string>(''); // sottocartella opzionale (es. per team)

  // Carica la lista file dell'utente
  const refresh = async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Devi essere autenticato');

      const basePrefix = `${user.id}${prefix ? '/' + prefix : ''}`;
      // Lista ricorsiva "semplice": partiamo dalla cartella utente
      const { data, error } = await supabase.storage.from(BUCKET).list(basePrefix, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;

      const files = (data ?? [])
        .filter((e) => !e.id?.endsWith('/')) // ignora entry vuote
        .map((e) => ({
          name: e.name,
          path: `${basePrefix}/${e.name}`,
          isFolder: e.id?.endsWith('/') ?? false,
        }));

      setItems(files);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [prefix]);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Devi essere autenticato');

      for (const file of Array.from(files)) {
        if (!ACCEPT.includes(file.type)) {
          alert(`Tipo non supportato: ${file.name}`);
          continue;
        }
        const key = `${user.id}${prefix ? '/' + prefix : ''}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : undefined),
        });
        if (error) throw error;
      }
      await refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  const openItem = async (it: Item) => {
    // genera signed URL e apre viewer
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(it.path, 60 * 60);
    if (error) return alert(error.message);

    // proviamo a dedurre il mime dal nome
    const mime =
      it.path.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : it.path.match(/\.(png|jpg|jpeg|webp)$/i)
        ? 'image/*'
        : 'application/octet-stream';

    setViewerMime(mime);
    setViewerUrl(data.signedUrl);
  };

  const closeViewer = () => {
    setViewerUrl(null);
    setViewerMime(null);
  };

  const isImage = (mime?: string | null) => mime?.startsWith('image/');
  const isPdf = (mime?: string | null) => mime === 'application/pdf';

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Documenti</h1>

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center px-3 py-2 rounded-lg border cursor-pointer">
          <input
            type="file"
            accept={ACCEPT.join(',')}
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
          {uploading ? 'Carico…' : 'Carica file (PDF/Immagini)'}
        </label>

        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Sottocartella (opz.)"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.trim())}
        />
      </div>

      <div className="border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6">Caricamento…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-gray-500">Nessun file presente.</div>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.path} className="flex items-center justify-between p-3">
                <div className="truncate">
                  <span className="font-medium truncate">{it.name}</span>
                  <div className="text-xs text-gray-500 truncate">{it.path}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded border"
                    onClick={() => openItem(it)}
                    title="Apri/visualizza"
                  >
                    Apri
                  </button>
                  <a
                    className="px-3 py-1 rounded border"
                    // download diretto (rigenera signed url breve)
                    onClick={async (e) => {
                      e.preventDefault();
                      const { data, error } = await supabase.storage
                        .from(BUCKET)
                        .createSignedUrl(it.path, 60);
                      if (error) return alert(error.message);
                      window.location.href = data.signedUrl;
                    }}
                  >
                    Scarica
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Viewer semplice */}
      {viewerUrl && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={closeViewer}
        >
          <div
            className="bg-white rounded-xl w-full max-w-4xl h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b">
              <div className="font-medium">Anteprima</div>
              <button className="px-3 py-1 rounded border" onClick={closeViewer}>
                Chiudi
              </button>
            </div>
            <div className="w-full h-full">
              {isImage(viewerMime) ? (
                <img src={viewerUrl} alt="preview" className="w-full h-full object-contain" />
              ) : isPdf(viewerMime) ? (
                <iframe src={viewerUrl} className="w-full h-full" title="PDF" />
              ) : (
                <div className="p-6">
                  Tipo non anteprimabile. Usa "Scarica".
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


