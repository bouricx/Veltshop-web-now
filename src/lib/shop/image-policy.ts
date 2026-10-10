import type { SiteConfiguration } from "./settings-schema";
export function imageTarget(kind: string, settings: SiteConfiguration) {
  if (kind === "banner")
    return { width: settings.imageBannerWidth, height: settings.imageBannerHeight };
  if (kind === "logo") return { width: settings.imageLogoWidth, height: settings.imageLogoHeight };
  const side =
    kind === "profile"
      ? settings.imageProfile
      : ["icon", "favicon"].includes(kind)
        ? settings.imageIcon
        : settings.imageSquare;
  return { width: side, height: side };
}
export function allowedImageFormats(settings: SiteConfiguration) {
  return settings.imageFormats.split(",");
}
