import logoDarkPng from "@/assets/logo-dark.png";
import logoDarkWebp from "@/assets/logo-dark.webp";
import logoLightPng from "@/assets/logo-light.png";
import logoLightWebp from "@/assets/logo-light.webp";
import { useTheme } from "@/lib/theme";

type LogoWordmarkProps = {
  size?: "sidebar" | "header";
};

/** Processed assets are ~680×170 (≈4:1). Heights keep width within each surface. */
const sizeClass = {
  sidebar: "h-[2.625rem] w-auto max-w-full sm:h-[3.25rem]",
  header: "h-14 w-auto sm:h-[4.25rem] lg:h-20",
};

export default function LogoWordmark({ size = "sidebar" }: LogoWordmarkProps) {
  const theme = useTheme();
  const isDark = theme === "dark";
  const heightClass = sizeClass[size];

  const png = isDark ? logoDarkPng : logoLightPng;
  const webp = isDark ? logoDarkWebp : logoLightWebp;

  return (
    <div className="logo-wordmark inline-flex max-w-full shrink-0 items-center">
      <picture className={`block max-w-full ${heightClass}`}>
        <source srcSet={webp} type="image/webp" />
        <img
          src={png}
          alt="RetainIQ"
          width={680}
          height={170}
          className={`${heightClass} max-w-full object-contain object-left`}
          decoding="async"
          draggable={false}
        />
      </picture>
    </div>
  );
}
