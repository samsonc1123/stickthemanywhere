import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

function UploadForm() {
  const [image, setImage] = useState(null);
  const [url, setUrl] = useState("");

  const handleUpload = async () => {
    if (!image) return alert("Please select a file first.");

    const imageRef = ref(storage, `stickers/${image.name}`);
    await uploadBytes(imageRef, image);
    const downloadURL = await getDownloadURL(imageRef);
    setUrl(downloadURL);
    alert("Upload complete!");
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3 style={{ color: "#0ff" }}>Upload a New Sticker</h3>
      <input type="file" onChange={(e) => setImage(e.target.files[0])} />
      <button onClick={handleUpload}>Upload</button>
      {url && (
        <div>
          <p>Uploaded Image:</p>
          <img src={url} alt="uploaded sticker" style={{ height: "150px", marginTop: "1rem" }} />
        </div>
      )}
    </div>
  );
}

export default UploadForm;