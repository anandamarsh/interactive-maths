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

const SHARE_TITLE = "Check out this maths game on CMaths!";
const SHARE_URL = "https://cmaths.com/";
const DEFAULT_DISCUSSIT_URL = import.meta.env.PROD
  ? "https://discussit-widget.vercel.app"
  : "http://localhost:5001";
const LOCAL_DISCUSSIT_URL = (import.meta.env.VITE_DISCUSSIT_URL ?? DEFAULT_DISCUSSIT_URL).replace(/\/$/, "");

export function SocialShare() {
  return (
    <div className="social-share-buttons">
      <TwitterShareButton url={SHARE_URL} title={SHARE_TITLE}>
        <span className="social-share-chip">
          <TwitterIcon size={42} round />
          <span>X</span>
        </span>
      </TwitterShareButton>
      <FacebookShareButton url={SHARE_URL}>
        <span className="social-share-chip">
          <FacebookIcon size={42} round />
          <span>Facebook</span>
        </span>
      </FacebookShareButton>
      <WhatsappShareButton url={SHARE_URL} title={SHARE_TITLE} separator=" - ">
        <span className="social-share-chip">
          <WhatsappIcon size={42} round />
          <span>WhatsApp</span>
        </span>
      </WhatsappShareButton>
      <LinkedinShareButton url={SHARE_URL} title={SHARE_TITLE} summary={SHARE_TITLE}>
        <span className="social-share-chip">
          <LinkedinIcon size={42} round />
          <span>LinkedIn</span>
        </span>
      </LinkedinShareButton>
    </div>
  );
}

/** Map current domain to canonical URL so comments stay consistent across domain changes */
function getCanonicalPageUrl(): string {
  if (typeof window === "undefined") return SHARE_URL;
  const url = new URL(window.location.href);
  url.hostname = "interactive-maths.vercel.app";
  url.port = "";
  url.protocol = "https:";
  return url.toString();
}

export function SocialComments({ composeRequest, reloadRequest }: { composeRequest: number; reloadRequest: number }) {
  const pageUrl = getCanonicalPageUrl();
  const iframeUrl = `${LOCAL_DISCUSSIT_URL}/?url=${encodeURIComponent(pageUrl)}&theme=dark`;
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
