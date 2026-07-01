"use client";

import { useState } from "react";

export function ExportPackForm({ action }: { action: (formData: FormData) => Promise<any> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData(e.currentTarget);
    try {
      const data = await action(formData);
      setResult(data);
      
      // Attempt to create a blob download if base64 is present
      if (data.encrypted_pack?.base64) {
        const byteCharacters = atob(data.encrypted_pack.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.encrypted_pack.mime_type });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 rounded text-xs">
          Export successful. Send the password to the factory separately!
        </div>
        
        {downloadUrl && (
          <a 
            href={downloadUrl} 
            download={result.encrypted_pack?.filename || "factory-pack.zip.enc"}
            className="block text-center rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500"
          >
            Download Encrypted Pack
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded text-xs">{error}</div>}
      
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1">Pack Encryption Password</label>
        <input 
          name="password" 
          type="text"
          required 
          minLength={24}
          placeholder="Min 24 characters..."
          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono text-sm" 
        />
        <p className="text-[10px] text-slate-500 mt-1">Generates AES-256-GCM zip. We do not store this password.</p>
      </div>
      
      <button 
        type="submit" 
        disabled={loading} 
        className="w-full rounded-lg bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {loading ? "Exporting..." : "Export Pack & Consume Keys"}
      </button>
    </form>
  );
}
