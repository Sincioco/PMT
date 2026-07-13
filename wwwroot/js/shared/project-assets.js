export function projectIconUrl(project = {}) {
  const iconUrl = project.iconUrl || "/assets/project-pmt.svg";
  const assetPath = iconUrl.split("?")[0];

  if (project.code === "LMS" && assetPath === "/assets/project-lms.svg") {
    return "/assets/project-lms.svg?v=20260621-new-logo";
  }
  if (project.code === "HLS" && assetPath === "/assets/project-hls.svg") {
    return "/assets/project-hls.svg?v=20260621-new-logo";
  }
  if (project.code === "PMT" && assetPath === "/assets/project-pmt.svg") {
    return "/assets/project-pmt.svg?v=20260621-transparent";
  }

  return iconUrl;
}
