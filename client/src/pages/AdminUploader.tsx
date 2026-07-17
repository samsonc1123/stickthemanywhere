import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { FRANCHISE_CHARACTERS } from '../data/franchiseCharacters';

// Reads the EXIF orientation tag from a JPEG file's raw bytes
function getExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xFFD8) return 1; // not a JPEG
  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;
    if (marker === 0xFFE1) {
      // APP1 marker — EXIF lives here
      offset += 2; // skip length
      if (view.getUint32(offset) !== 0x45786966) return 1; // "Exif"
      offset += 6; // skip "Exif\0\0"
      const tiffStart = offset;
      const littleEndian = view.getUint16(tiffStart) === 0x4949;
      const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const numEntries = view.getUint16(tiffStart + ifdOffset, littleEndian);
      for (let i = 0; i < numEntries; i++) {
        const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
        if (view.getUint16(entryOffset, littleEndian) === 0x0112) {
          return view.getUint16(entryOffset + 8, littleEndian);
        }
      }
      return 1;
    } else if ((marker & 0xFF00) !== 0xFF00) {
      break;
    } else {
      offset += view.getUint16(offset);
    }
  }
  return 1;
}

// Draws the image onto a canvas with EXIF rotation corrected, returns a new File
async function autoOrientFile(file: File): Promise<File> {
  // Only JPEG/JPG files carry EXIF orientation
  if (!file.type.match(/jpeg|jpg/i)) return file;

  const buffer = await file.arrayBuffer();
  const orientation = getExifOrientation(buffer);
  if (orientation === 1) return file; // already correct

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Orientations 5-8 swap width/height
      const swap = orientation >= 5;
      canvas.width  = swap ? h : w;
      canvas.height = swap ? w : h;

      ctx.save();
      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, h, w); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
      }
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name, { type: file.type }));
      }, file.type);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

interface UploadResult {
  assetCode: string;
  storagePath: string;
  filename: string;
  alreadyExists: boolean;
}

export default function AdminUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [categoryCode, setCategoryCode] = useState('');
  const [subcategoryCode, setSubcategoryCode] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [tapZoneFeedback, setTapZoneFeedback] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const categories = useQuery(api.categories.getAllCategories) ?? [];
  const subcategories = useQuery(
    api.subcategories.getSubcategoriesByCategory,
    categoryCode ? { categoryCode } : "skip"
  ) ?? [];
  const recentStickerData = useQuery(api.stickers.listAllStickers) ?? [];

  const ensureTaxonomySeeded = useMutation(api.seedTaxonomy.ensureTaxonomySeeded);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const finalizeStickerUpload = useMutation(api.stickers.finalizeStickerUpload);
  const sendUploadConfirmation = useAction(api.email.sendUploadConfirmation);

  useEffect(() => {
    ensureTaxonomySeeded({}).catch(() => {});
  }, []);

  const handleTapZone = (target: string) => {
    setTapZoneFeedback(target);
    setTimeout(() => setTapZoneFeedback(null), 300);
    if (target === 'BACK') {
      window.history.back();
    } else {
      setLocation(target);
    }
  };

  // Derive the selected subcategory's display name for the name prefix
  const selectedSub = subcategories.find(s => s.code === subcategoryCode);
  const subName = selectedSub?.name ?? '';

  // Franchise pipeline (e.g. Star Wars) → needs a character name
  // Simple pipeline (e.g. Jordan) → skip it, name = subcategory name
  const isFranchise = subcategoryCode ? subcategoryCode in FRANCHISE_CHARACTERS : false;

  // Full composed name: franchise → "Star Wars - Darth Vader", simple → "Jordan"
  const composedName = isFranchise
    ? (characterName.trim() ? `${subName} - ${characterName.trim()}` : '')
    : subName;

  const handleCategoryChange = (code: string) => {
    setCategoryCode(code);
    setSubcategoryCode('');
    setCharacterName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    const invalidFiles = selectedFiles.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      const validMime = ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'].includes(file.type);
      const validExt = ['png', 'webp', 'jpg', 'jpeg'].includes(ext ?? '');
      return !validMime && !validExt;
    });

    if (invalidFiles.length > 0) {
      toast({
        title: 'Invalid File Type',
        description: `Only PNG, WebP, and JPG files are supported. Invalid: ${invalidFiles.map(f => f.name).join(', ')}`,
        variant: 'destructive',
      });
      e.target.value = '';
      setFiles([]);
      return;
    }

    // Auto-correct EXIF orientation before storing
    Promise.all(selectedFiles.map(autoOrientFile)).then(setFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one file to upload', variant: 'destructive' });
      return;
    }

    if (!categoryCode || !subcategoryCode) {
      toast({ title: 'Error', description: 'Please select a category and subcategory', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setUploadResults([]);

    try {
      const results: UploadResult[] = [];

      for (const file of files) {
        const uploadUrl = await generateUploadUrl();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { storageId } = await uploadResponse.json();
        // Use the composed "Franchise - Character" name if provided,
        // otherwise fall back to the filename (for batch uploads without a name)
        const nameWithoutExt = file.name.replace(/\.(png|webp|jpg|jpeg)$/i, '');
        const stickerName = composedName || nameWithoutExt;

        const result = await finalizeStickerUpload({
          storageId,
          name: stickerName,
          filename: file.name,
          categoryCode,
          subcategoryCode,
          isFranchise,
        });

        results.push({
          assetCode: result.code,
          storagePath: storageId,
          filename: file.name,
          alreadyExists: result.alreadyExists ?? false,
        });

        try {
          await sendUploadConfirmation({
            stickerCode: result.code,
            stickerName: nameWithoutExt,
            categoryCode,
            subcategoryCode,
            filename: file.name,
          });
        } catch (emailErr) {
          console.warn('Email confirmation failed (non-blocking):', emailErr);
        }
      }

      setUploadResults(results);

      const newCount = results.filter(r => !r.alreadyExists).length;
      const dupeCount = results.filter(r => r.alreadyExists).length;
      let desc = `${newCount} new sticker(s) uploaded`;
      if (dupeCount > 0) desc += `, ${dupeCount} already existed`;

      toast({ title: 'Upload Complete', description: desc });

      setFiles([]);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Upload Failed', description: error.message || 'An error occurred during upload', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const recentStickers = recentStickerData.slice(0, 20);

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron p-4 relative">
      <div
        onTouchStart={() => handleTapZone('/admin')}
        onClick={() => handleTapZone('/admin')}
        className={`fixed top-0 left-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === '/admin' ? 'bg-white/30' : 'bg-transparent'}`}
        title="Admin Dugout"
        style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
      />
      <div
        onTouchStart={() => handleTapZone('/admin/prefix-mapper')}
        onClick={() => handleTapZone('/admin/prefix-mapper')}
        className={`fixed top-0 right-0 w-[150px] h-[150px] z-[9999] cursor-pointer transition-all ${tapZoneFeedback === '/admin/prefix-mapper' ? 'bg-white/30' : 'bg-transparent'}`}
        title="Prefix Rules"
        style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
      />

      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 pt-4">
          <h1
            className="text-3xl md:text-4xl font-orbitron font-bold tracking-wider uppercase"
            style={{
              background: 'linear-gradient(45deg, #00ff88, #00ffff, #0088ff, #00ff88)',
              backgroundSize: '300% 300%',
              animation: 'gradient-shift 4s ease infinite',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Admin Uploader
          </h1>
          <style>{`
            @keyframes gradient-shift {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
          `}</style>
        </div>

        <div className="bg-black/40 border-2 border-cyan-400 rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="file" className="text-white">
                Sticker Images * (PNG or WebP)
              </Label>
              <Input
                id="file"
                type="file"
                accept="image/png,image/webp,image/jpeg,image/jpg"
                multiple
                onChange={handleFileChange}
                className="bg-gray-800 border-gray-600 text-white"
                data-testid="input-file"
              />
              {files.length > 0 && (
                <p className="text-sm text-cyan-400 mt-1">
                  {files.length === 1
                    ? `Selected: ${files[0].name}`
                    : `Selected ${files.length} files`}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="category" className="text-white">
                Category *
              </Label>
              <Select value={categoryCode} onValueChange={handleCategoryChange}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white" data-testid="select-category">
                  <SelectValue placeholder={categories.length === 0 ? "Loading..." : "Select category"} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 max-h-60 overflow-y-auto z-50">
                  {categories
                    .filter(cat => cat.code !== 'ANI')
                    .map((cat) => (
                      <SelectItem key={cat.code} value={cat.code} className="text-white hover:bg-gray-700">
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subcategory" className="text-white">
                Subcategory * (prefix)
              </Label>
              <Select value={subcategoryCode} onValueChange={setSubcategoryCode} disabled={!categoryCode}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white" data-testid="select-subcategory">
                  <SelectValue placeholder={categoryCode ? (subcategories.length === 0 ? "Loading..." : "Select subcategory") : "Select category first"} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 max-h-60 overflow-y-auto z-50">
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.code} value={sub.code} className="text-white hover:bg-gray-700">
                      {sub.code} — {sub.name || sub.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subcategoryCode && isFranchise && (
              <div>
                <Label htmlFor="charname" className="text-white">
                  Character Name *
                </Label>
                <Input
                  id="charname"
                  type="text"
                  placeholder="e.g. Darth Vader"
                  value={characterName}
                  onChange={e => setCharacterName(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
            )}

            {subcategoryCode && composedName && (
              <p className="text-cyan-400 text-xs font-mono -mt-1">
                Will be saved as: <span className="text-yellow-400 font-bold">{composedName}</span>
              </p>
            )}

            <Button
              type="submit"
              disabled={isUploading || files.length === 0 || !categoryCode || !subcategoryCode || (isFranchise && !characterName.trim())}
              className="w-full bg-cyan-400 hover:bg-cyan-500 text-black font-bold"
              data-testid="button-upload"
            >
              {isUploading
                ? `Uploading ${files.length} file(s)...`
                : `Upload ${files.length > 0 ? files.length : ''} Sticker(s)`.trim()}
            </Button>
          </form>

          {uploadResults.length > 0 && (
            <div className="mt-6 p-4 bg-green-900/30 border border-green-400 rounded">
              <p className="text-green-400 font-bold mb-3">Upload Complete — {uploadResults.length} sticker(s)</p>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {uploadResults.map((result, idx) => (
                  <div key={idx} className="bg-black/30 p-2 rounded text-xs">
                    <p className="text-cyan-400 font-mono">{result.assetCode} {result.alreadyExists ? '(duplicate)' : '(new)'}</p>
                    <p className="text-gray-400 text-xs mt-1">{result.filename}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {recentStickers.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-audiowide text-yellow-400 mb-4">Recent Stickers</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {recentStickers.map((sticker) => (
                <div key={sticker._id} className="bg-black/40 border border-cyan-400/50 rounded-lg p-2 text-center">
                  {sticker.imageUrl ? (
                    <img
                      src={sticker.imageUrl}
                      alt={sticker.name || sticker.code}
                      className="w-full h-28 object-contain rounded mb-2"
                    />
                  ) : (
                    <div className="w-full h-28 bg-gray-800 rounded mb-2 flex items-center justify-center text-gray-500 text-xs">
                      No image
                    </div>
                  )}
                  <p className="text-cyan-400 font-mono text-xs truncate">{sticker.code}</p>
                  <p className="text-gray-400 text-xs truncate">{sticker.name || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
