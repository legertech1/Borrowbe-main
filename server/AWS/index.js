const {
  CreateBucketCommand,
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

const { v4: uuid } = require("uuid");

module.exports = {
  uploadImage: async function (base64, key = null) {
    // Decode the base64 string to binary data
    const binaryData = Buffer.from(
      base64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const Key = key
      ? key.split("/").reverse()[0]
      : `${uuid()}.${base64.split(";")[0].split("/")[1]}`;
    // Create a PutObjectCommand to upload the image
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key,
      Body: binaryData,
      ContentType: base64.split(";")[0].split("/")[1], // Set the appropriate content type
    });

    try {
      // Upload the image to S3
      await s3Client.send(command);
      const url = `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${Key}`;

      // Return the URL
      return url;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  },
  deleteImage: async function (key) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: key.split("/").reverse()[0],
    });

    try {
      // Delete the image from S3
      await s3Client.send(command);
      return "deleted";
    } catch (error) {
      console.error("Error deleting image:", error);
      throw error;
    }
  },
};
