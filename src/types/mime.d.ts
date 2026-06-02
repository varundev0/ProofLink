declare module 'mime' {
  const mime: {
    getType(path: string): string | null;
    getExtension(mime: string): string | null;
  };
  export default mime;
}
