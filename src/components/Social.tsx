import { useEffect, useRef } from "react";
import {
  FacebookIcon,
  FacebookShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from "react-share";

const SHARE_TITLE = "Check out this maths game on Interactive Maths!";
const SHARE_URL = "https://interactive-maths.vercel.app/";
const CUSDIS_HOST = "https://cusdis.com";
const CUSDIS_APP_ID = "b7cf3bec-b283-485f-9db9-8e7f3cfac3c2";
const COMMENTS_PAGE_ID = "interactive-maths";
const COMMENTS_TITLE = "Interactive Maths";

function ensureCusdisLoaded() {
  const existing = document.querySelector('script[data-cusdis-script="true"]');
  if (existing) return existing;

  const script = document.createElement("script");
  script.async = true;
  script.defer = true;
  script.src = `${CUSDIS_HOST}/js/cusdis.es.js`;
  script.dataset.cusdisScript = "true";
  document.body.appendChild(script);
  return script;
}

export function SocialShare() {
  return (
    <div className="social-share-buttons">
      <TwitterShareButton url={SHARE_URL} title={SHARE_TITLE}>
        <span className="social-share-chip">
          <TwitterIcon size={36} round />
          <span>X</span>
        </span>
      </TwitterShareButton>
      <FacebookShareButton url={SHARE_URL}>
        <span className="social-share-chip">
          <FacebookIcon size={36} round />
          <span>Facebook</span>
        </span>
      </FacebookShareButton>
      <WhatsappShareButton url={SHARE_URL} title={SHARE_TITLE} separator=" - ">
        <span className="social-share-chip">
          <WhatsappIcon size={36} round />
          <span>WhatsApp</span>
        </span>
      </WhatsappShareButton>
      <LinkedinShareButton url={SHARE_URL} title={SHARE_TITLE} summary={SHARE_TITLE}>
        <span className="social-share-chip">
          <LinkedinIcon size={36} round />
          <span>LinkedIn</span>
        </span>
      </LinkedinShareButton>
    </div>
  );
}

export function SocialComments() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const script = ensureCusdisLoaded();

    const stretchIframe = () => {
      const iframe = hostRef.current?.querySelector("iframe");
      if (iframe instanceof HTMLIFrameElement) {
        iframe.style.height = "100%";
        iframe.style.minHeight = "100%";
      }
    };

    const renderCusdis = () => {
      const api = (window as typeof window & {
        CUSDIS?: { renderTo?: (target: HTMLElement) => void };
      }).CUSDIS;
      if (api?.renderTo && hostRef.current) {
        api.renderTo(hostRef.current);
        requestAnimationFrame(stretchIframe);
        window.setTimeout(stretchIframe, 150);
      }
    };

    if ((window as typeof window & { CUSDIS?: unknown }).CUSDIS) {
      renderCusdis();
      return;
    }

    script?.addEventListener("load", renderCusdis, { once: true });
    return () => script?.removeEventListener("load", renderCusdis);
  }, []);

  return (
    <div style={{ padding: "1rem 1rem 1.25rem", height: "100%", boxSizing: "border-box" }}>
      <div
        id="cusdis_thread"
        ref={hostRef}
        data-host={CUSDIS_HOST}
        data-app-id={CUSDIS_APP_ID}
        data-page-id={COMMENTS_PAGE_ID}
        data-page-url={SHARE_URL}
        data-page-title={COMMENTS_TITLE}
        data-theme="dark"
        style={{ height: "100%", minHeight: "100%" }}
      />
    </div>
  );
}
