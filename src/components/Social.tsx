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

const SHARE_TITLE = "Check out this maths game on See Maths!";
const DEFAULT_SHARE_URL = "https://seemaths.com/";
const DEFAULT_DISCUSSIT_URL = import.meta.env.PROD
  ? "https://discussit-widget.vercel.app"
  : "http://localhost:5001";
const LOCAL_DISCUSSIT_URL = (import.meta.env.VITE_DISCUSSIT_URL ?? DEFAULT_DISCUSSIT_URL)
  .trim()
  .replace(/\/$/, "");

export function SocialShare({ shareUrl = DEFAULT_SHARE_URL }: { shareUrl?: string }) {
  return (
    <div className="social-share-buttons">
      <TwitterShareButton url={shareUrl} title={SHARE_TITLE}>
        <span className="social-share-chip">
          <TwitterIcon size={42} round />
          <span>X</span>
        </span>
      </TwitterShareButton>
      <FacebookShareButton url={shareUrl}>
        <span className="social-share-chip">
          <FacebookIcon size={42} round />
          <span>Facebook</span>
        </span>
      </FacebookShareButton>
      <WhatsappShareButton url={shareUrl} title={SHARE_TITLE} separator=" - ">
        <span className="social-share-chip">
          <WhatsappIcon size={42} round />
          <span>WhatsApp</span>
        </span>
      </WhatsappShareButton>
      <LinkedinShareButton url={shareUrl} title={SHARE_TITLE} summary={SHARE_TITLE}>
        <span className="social-share-chip">
          <LinkedinIcon size={42} round />
          <span>LinkedIn</span>
        </span>
      </LinkedinShareButton>
    </div>
  );
}

/** Normalize thread URLs so shell comments stay stable across host changes and game comments stay host-root scoped. */
function getCanonicalPageUrl(pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    url.hash = "";

    if (
      url.hostname === "seemaths.com" ||
      url.hostname === "www.seemaths.com" ||
      url.hostname === "interactive-maths.vercel.app"
    ) {
      url.hostname = "seemaths.com";
      url.port = "";
      url.protocol = "https:";
      return url.toString();
    }

    url.search = "";
    return url.toString();
  } catch {
    return DEFAULT_SHARE_URL;
  }
}

export function SocialComments({
  pageUrl,
  composeRequest,
  reloadRequest,
}: {
  pageUrl: string;
  composeRequest: number;
  reloadRequest: number;
}) {
  const canonicalPageUrl = getCanonicalPageUrl(pageUrl);
  const iframeUrl = `${LOCAL_DISCUSSIT_URL}/?url=${encodeURIComponent(canonicalPageUrl)}&theme=dark`;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!composeRequest) {
      return;
    }

    iframeRef.current?.contentWindow?.postMessage(
      { type: "discussit:open-composer" },
      LOCAL_DISCUSSIT_URL,
    );
  }, [composeRequest]);

  useEffect(() => {
    if (!reloadRequest || !iframeRef.current) {
      return;
    }

    iframeRef.current.src = iframeUrl;
  }, [iframeUrl, reloadRequest]);

  return (
    <div style={{ padding: "0", height: "100%", boxSizing: "border-box" }}>
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        title="DiscussIt comments"
        style={{
          width: "100%",
          height: "100%",
          minHeight: "100%",
          border: 0,
          borderRadius: "0",
          background: "transparent",
        }}
      />
    </div>
  );
}
