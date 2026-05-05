import ImageKit from "imagekit";

let client: ImageKit | null = null;

export function isImageKitConfigured(): boolean {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT,
  );
}

/** Lazily constructed — avoids throwing when env is missing until upload runs. */
export function getImageKit(): ImageKit {
  if (!client) {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, "");
    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Error("ImageKit is not configured (IMAGEKIT_* env vars)");
    }
    client = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint,
    });
  }
  return client;
}
