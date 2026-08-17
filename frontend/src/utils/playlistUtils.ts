export function isPlaylistUrl(url: string): boolean {
  return (
    url.includes("list=") ||
    url.includes("/playlist") ||
    (url.includes("soundcloud.com") && url.includes("/sets/"))
  );
}
