"use client";

import { useServerInsertedHTML } from "next/navigation";
import { THEME_STORAGE_KEY } from "@/components/theme-provider";

/** Injects a blocking theme boot script without a React client <script> warning. */
export function ThemeScript() {
  useServerInsertedHTML(() => (
    <script
      id="nsbm-theme-boot"
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d){r.classList.add("dark");r.style.colorScheme="dark";}else{r.classList.remove("dark");r.style.colorScheme="light";}}catch(e){}})();`,
      }}
    />
  ));

  return null;
}
