export const DEFAULT_AVATAR = "/favicon.svg";

export function profileImageOrDefault(image: string | null | undefined): string {
  return image?.trim() || DEFAULT_AVATAR;
}
