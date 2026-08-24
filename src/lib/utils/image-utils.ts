/**
 * Utilitário para processar e comprimir fotos de perfil de atletas em Base64
 */
export async function fileToCompressedBase64(file: File, maxSize = 300, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    // Se não for arquivo de imagem válido
    if (!file.type.startsWith('image/')) {
      reject(new Error('Formato de arquivo inválido. Por favor selecione uma imagem.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Mantém proporção máxima
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Erro ao processar imagem selecionada.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de foto.'));
    reader.readAsDataURL(file);
  });
}
