import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "@aws-sdk/client-s3"],
};

export default nextConfig;
