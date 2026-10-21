import { ImageUp, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { IMAGE_TYPES, imageProblem } from '@/lib/images';

type ImageUploadProps = {
  /** Sustantivo de los botones: «foto» → «Subir foto», «Cambiar foto», «Quitar foto». */
  noun: string;
  hasImage: boolean;
  uploading: boolean;
  removing: boolean;
  /** Solo recibe archivos que pasaron la validación local. */
  onFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
};

/** Botones para subir, cambiar o quitar una imagen (foto de perfil, logo). */
export function ImageUpload({
  noun,
  hasImage,
  uploading,
  removing,
  onFile,
  onRemove,
  disabled = false,
}: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">JPG, PNG o WEBP de máximo 2 MB.</p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const problem = imageProblem(file);
            if (problem) toast.error(problem);
            else onFile(file);
          }}
        />
        <Button
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => input.current?.click()}
        >
          <ImageUp aria-hidden="true" />
          {uploading ? 'Subiendo…' : hasImage ? `Cambiar ${noun}` : `Subir ${noun}`}
        </Button>
        {hasImage && (
          <Button variant="ghost" disabled={disabled || removing} onClick={onRemove}>
            <Trash2 aria-hidden="true" />
            {removing ? 'Quitando…' : `Quitar ${noun}`}
          </Button>
        )}
      </div>
    </div>
  );
}
