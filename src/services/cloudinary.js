import cloudinary from "cloudinary";
import dotenv from "dotenv";
dotenv.config();


cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});


const uploadToCloudinary = async (filePath, folderName = "default") => {
    try {
      const result = await cloudinary.v2.uploader.upload(filePath, {
        folder: `Study-Cafe/${folderName}`,  // This will create/use the Yellow-page folder
        use_filename: true,    // Optional: keeps original filename
        unique_filename: false, // Optional: allows duplicates
        overwrite: true        // Optional: overwrites if file exists
      });
      return result;
    } catch (error) {
      console.error("Error uploading file to Cloudinary:", error);
      throw new Error("Cloudinary upload failed");
    }
  };

export { uploadToCloudinary };
