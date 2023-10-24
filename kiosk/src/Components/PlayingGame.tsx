import { useContext, useEffect, useMemo, useState } from "react";
import { AppStateContext } from "../State/AppStateContext";
import { escapeGame } from "../Transforms/escapeGame";
import { playSoundEffect } from "../Services/SoundEffectService";
import { useOnControlPress } from "../Hooks";
import { stringifyQueryString } from "../Utils";
import * as GamepadManager from "../Services/GamepadManager";
import * as IndexedDb from "../Services/IndexedDb";
import configData from "../config.json";

export default function PlayingGame() {
    const { state: kiosk, dispatch } = useContext(AppStateContext);
    const { launchedGameId: gameId } = kiosk;

    // Handle Escape and Menu button presses
    useOnControlPress(
        [],
        () => {
            playSoundEffect("select");
            escapeGame();
        },
        GamepadManager.GamepadControl.EscapeButton,
        GamepadManager.GamepadControl.ResetButton
    );

    const [fetchingBuiltJsInfo, setFetchingBuiltJsInfo] = useState(true);
    const [builtJsInfo, setBuiltJsInfo] = useState<
        pxtc.BuiltSimJsInfo | undefined
    >(undefined);

    useEffect(() => {
        if (gameId) {
            // Try to fetch the built game from local storage.
            IndexedDb.getBuiltJsInfoAsync(gameId).then(builtGame => {
                setBuiltJsInfo(builtGame);
                setFetchingBuiltJsInfo(false);
            });
        }
    }, [gameId]);

    const playUrl = useMemo(() => {
        if (gameId && !fetchingBuiltJsInfo) {
            return stringifyQueryString(configData.PlayUrlRoot, {
                id: gameId,
                // TODO: Show sim buttons on mobile & touch devices.
                hideSimButtons: 1,
                noFooter: 1,
                single: 1,
                fullscreen: 1,
                autofocus: 1,
                loadingColor: "white",
                // If we have the built game cached, we will send it to the
                // simulator once it loads. The `server` flag inhibits the
                // simulator from trying to build it.
                server: builtJsInfo ? 1 : undefined,
                // If we don't have the built game cached, tell the simulator to
                // send it to us once it's built and we'll cache it.
                sendBuilt: builtJsInfo ? undefined : 1,
            });
        }
    }, [gameId, fetchingBuiltJsInfo]);

    return (
        <iframe
            className="sim-embed"
            sandbox="allow-popups allow-forms allow-scripts allow-same-origin"
            src={playUrl}
        ></iframe>
    );
}
