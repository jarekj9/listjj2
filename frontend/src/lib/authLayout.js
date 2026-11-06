export function getAuthProviderButtonWidth(containerWidth, viewportWidth) {
  const availableWidth = containerWidth || Math.max(120, viewportWidth - 40);
  return Math.min(360, availableWidth);
}
