/*
 * Home — simxr.tech landing page in the cyanotype system (same tokens and
 * components as /what-we-do/).
 *
 * The markup lives in ./home/home.html as a plain HTML fragment and the
 * styles in ./home/home.css, scoped under `.cy` so nothing leaks into the
 * operator console that shares this bundle. Edit those two files; this
 * component only mounts them.
 *
 * home.css = the stylesheet of client/public/what-we-do/index.html with
 * every selector prefixed by `.cy`, plus the home-only blocks at the end.
 */
import { useEffect } from "react";
import "./home/home.css";
import homeHtml from "./home/home.html?raw";

export default function Home() {
  useEffect(() => {
    document.title = "SIM XR — Teaching infrastructure for every robot";
  }, []);

  return <div className="cy" dangerouslySetInnerHTML={{ __html: homeHtml }} />;
}
