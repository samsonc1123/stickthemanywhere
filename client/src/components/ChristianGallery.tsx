import { useMemo } from 'react';

interface ImageGroup {
  folderName: string;
  images: string[];
}

export function ChristianGallery() {
  const imageGroups = useMemo(() => {
    // Load all PNG images from public/stickers/christian/** subfolders
    const imageModules = import.meta.glob('/public/stickers/christian/**/*.png', { 
      eager: true,
      query: '?url',
      import: 'default'
    });

    // Group images by folder name
    const groups: Record<string, string[]> = {};

    Object.entries(imageModules).forEach(([path, url]) => {
      // Extract folder name from path: /public/stickers/christian/hearts/image.png -> hearts
      const pathParts = path.split('/');
      const folderIndex = pathParts.findIndex(part => part === 'christian') + 1;
      
      if (folderIndex > 0 && folderIndex < pathParts.length - 1) {
        const folderName = pathParts[folderIndex];
        
        if (!groups[folderName]) {
          groups[folderName] = [];
        }
        
        // Convert the path to a public URL
        const publicUrl = path.replace('/public', '');
        groups[folderName].push(publicUrl);
      }
    });

    // Convert to array and sort
    return Object.entries(groups)
      .map(([folderName, images]): ImageGroup => ({
        folderName,
        images: images.sort()
      }))
      .sort((a, b) => a.folderName.localeCompare(b.folderName));
  }, []);

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
  };

  if (imageGroups.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4 text-neon-yellow">Christian Gallery</h2>
          <p className="text-gray-300">
            Add PNG images to subfolders in <code className="bg-gray-800 px-2 py-1 rounded">public/stickers/christian/</code> to see them here!
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Create folders like: hearts/, crosses/, scripture/, etc.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-8 text-neon-yellow">
        Christian Gallery
      </h1>
      
      {imageGroups.map(({ folderName, images }) => (
        <div key={folderName} className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            {capitalizeFirst(folderName)}
          </h2>
          
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-neon-blue">
            {images.map((imageUrl, index) => (
              <div
                key={`${folderName}-${index}`}
                className="flex-shrink-0 w-[150px] h-[150px] border-2 border-neon-blue rounded-lg overflow-hidden hover:border-neon-pink transition-colors duration-300 hover:shadow-lg hover:shadow-neon-blue/50"
              >
                <img
                  src={imageUrl}
                  alt={`${folderName} sticker ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiBmaWxsPSIjMTExODI3Ii8+Cjx0ZXh0IHg9Ijc1IiB5PSI3NSIgZmlsbD0iIzZCNzI4MCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pgo8L3N2Zz4K';
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}