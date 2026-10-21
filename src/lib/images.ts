/** Fotos de perfil y logos: lo mismo que valida el backend (IMAGE_MAX_BYTES). */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** Por qué no sirve el archivo, o null si sirve. El backend vuelve a validarlo. */
export function imageProblem(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Usa una imagen JPG, PNG o WEBP.';
  if (file.size > IMAGE_MAX_BYTES) return 'La imagen pesa más de 2 MB. Elige una más liviana.';
  return null;
}

/** Cuerpo multipart con el archivo en el campo `file` (openapi-fetch). */
export function fileBody(file: File) {
  return {
    body: { file: '' },
    bodySerializer: () => {
      const data = new FormData();
      data.append('file', file);
      return data;
    },
  };
}
