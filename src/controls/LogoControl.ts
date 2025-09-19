import type { IControl, Map as mlMap } from "maplibre-gl";

/* static assets */
import Logo from "./logo.svg?raw";
import './logo.css';

export class LogoControl implements IControl {
    private _container?: HTMLElement;

    onAdd(_map: mlMap): HTMLElement {
        this._container = document.createElement("div");
        this._container.classList.add("maplibregl-ctrl");
        this._container.id = "ls-logo-maplibre"

        const anchor = document.createElement("a");
        anchor.innerHTML = Logo;
        anchor.target = "_blank";
        anchor.rel = "noopener nofollow";
        anchor.href = "https://www.lynker-spatial.com";
        anchor.setAttribute("aria-label", "Lynker Spatial logo");
        this._container.appendChild(anchor);

        return this._container;
    }

    onRemove(_map: mlMap): void {
        this._container?.remove();
        this._container = undefined;
    }
}
