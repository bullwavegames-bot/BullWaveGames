import type { Props } from "./common";
import "./games.css";
import { Solitaire, Rummy, ChessGame } from "./Cards";
import { LocalLudo } from "./Ludo";
import {
  Tiles2048,
  WordGuess,
  Sudoku,
  Crossword,
  MemoryMatch,
  Jigsaw,
  MatchThree,
} from "./Puzzles";
import {
  Snake,
  AimTrainer,
  Highway,
  BlobArena,
  Carrom,
  TowerDefense,
  BubbleShooter,
} from "./Arcade";
import { Quiz } from "./Quiz";
import { IdleCity, Tycoon, TerritoryStrategy } from "./Strategy";
import { RoomGame } from "./Rooms";
export function CollectionGame(props: Props) {
  switch (props.api.slug) {
    case "solitaire":
      return <Solitaire {...props} />;
    case "spider-solitaire":
      return <Solitaire {...props} spider />;
    case "rummy":
      return <Rummy {...props} />;
    case "chess":
      return <ChessGame {...props} />;
    case "ludo":
      return <LocalLudo {...props} />;
    case "carrom":
      return <Carrom {...props} />;
    case "sudoku":
      return <Sudoku {...props} />;
    case "2048":
      return <Tiles2048 {...props} />;
    case "crossword":
      return <Crossword {...props} />;
    case "word-guess":
      return <WordGuess {...props} />;
    case "match-3":
      return <MatchThree {...props} />;
    case "jigsaw":
      return <Jigsaw {...props} />;
    case "memory-match":
      return <MemoryMatch {...props} />;
    case "snake-arena":
      return <Snake {...props} />;
    case "blob-arena":
      return <BlobArena {...props} />;
    case "endless-runner":
      return <Highway {...props} />;
    case "racing-rush":
      return <Highway {...props} racing />;
    case "aim-trainer":
      return <AimTrainer {...props} />;
    case "tower-defense":
      return <TowerDefense {...props} />;
    case "bubble-shooter":
      return <BubbleShooter {...props} />;
    case "general-knowledge":
      return <Quiz {...props} topic="general" />;
    case "sports-trivia":
      return <Quiz {...props} topic="sports" />;
    case "movie-trivia":
      return <Quiz {...props} topic="movies" />;
    case "idle-city":
      return <IdleCity {...props} />;
    case "tycoon":
      return <Tycoon {...props} />;
    case "territory-strategy":
      return <TerritoryStrategy {...props} />;
    case "draw-guess":
    case "multiplayer-ludo":
    case "live-trivia":
    case "trivia-battle":
      return <RoomGame {...props} />;
    default:
      return <p>Game unavailable. Return to the catalog.</p>;
  }
}
