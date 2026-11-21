import { useRef, useState } from "react";

const images = [
  {
    src: "/images/accordion-1.png", number: "01", name: "Ruarc",
    title: "Ruarc",
    description: "Ruarc’s introduction will be added here. His background, place in the world, and story are yet to be revealed.",
  },
  {
    src: "/images/accordion-2.png", number: "02", name: "Liutpold",
    title: "Liutpold",
    description: "Liutpold’s introduction will be added here. His background, place in the world, and story are yet to be revealed.",
  },
  {
    src: "/images/accordion-3.png", number: "03", name: "Vidran",
    title: "Vidran",
    description: "Vidran’s introduction will be added here. His background, place in the world, and story are yet to be revealed.",
  },
  {
    src: "/images/accordion-4.png", number: "04", name: "Bennon",
    title: "Bennon",
    description: "Bennon’s introduction will be added here. His background, place in the world, and story are yet to be revealed.",
  },
];

function ImagePanel({ src, number, name, active, onSelect }: {
  src: string; number: string; name: string; active: boolean; onSelect: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      aria-label={`View ${name} and character introduction`}
      aria-pressed={active}
      aria-controls="character-introduction"
      onClick={onSelect}
      className={`group relative min-w-0 cursor-pointer self-stretch overflow-hidden rounded-xl bg-transparent text-left outline-none transition-[flex-grow] duration-[1000ms] ease-in-out focus-visible:ring-2 focus-visible:ring-[#d4b889] focus-visible:ring-offset-4 focus-visible:ring-offset-[#111111] motion-reduce:transition-none md:rounded-2xl ${
        active ? "flex-[6] md:flex-[3.7]" : "flex-1"
      }`}
    >
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#242321] text-[#d6c6ac]">
          <svg role="img" aria-label="Image unavailable" viewBox="0 0 100 140" className="h-28 w-20 shrink-0" fill="none">
            <rect x="8" y="8" width="84" height="124" rx="8" stroke="currentColor" />
            <circle cx="62" cy="42" r="10" stroke="currentColor" />
            <path d="m8 105 30-38 25 25 16-18 13 19" stroke="currentColor" />
          </svg>
          {active && <span className="text-sm">Image unavailable</span>}
        </div>
      ) : (
        <div className="absolute inset-0">
        <img src={src} alt={`Portrait of ${name}`}
          onError={() => setFailed(true)} draggable={false}
          className={`absolute left-1/2 top-0 h-full w-[calc((100cqw_-_24px)*2/3)] max-w-none -translate-x-1/2 object-cover transition-[filter] duration-[1000ms] ease-in-out motion-reduce:transition-none md:w-[calc((100cqw_-_48px)*37/67)] ${
            active ? "brightness-100" : "brightness-[.62] group-hover:brightness-90"
          }`} />
        </div>
      )}
      {!active && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />}
      <span className={`absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-white/30 bg-black/45 px-2.5 py-1.5 text-xs text-white backdrop-blur-md transition-colors md:top-6 ${active ? "border-[#d4b889]/70 text-[#f0dfc2]" : ""}`}>
        {number}
      </span>
    </button>
  );
}

export default function App() {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);
  const panelRefs = useRef<HTMLDivElement | null>(null);
  const move = (direction: number) => setActive((value) => (value + direction + images.length) % images.length);

  return (
    <main lang="en" className="min-h-screen overflow-x-hidden bg-[#111111] px-5 pt-[14px] font-sans text-[#f1eee8] sm:px-10 lg:px-16">
      <div className="@container mx-auto max-w-[1500px]">
        <section aria-label="Character portrait accordion gallery" aria-roledescription="carousel" className="pt-[50px]">
          <div className="mb-8 w-fit max-w-full">
            <div>
              <p className="mb-4 text-xs font-bold tracking-[.26em] text-[#cbb18a]"><span className="text-[15px] font-normal tracking-[0.5px]" style={{ fontFamily: '"Cinzel", serif' }}>CAST of CHARACTERS</span></p>
              <h1 className="text-[33px] font-bold leading-tight tracking-[0.8px] [overflow-wrap:anywhere]"><span>NORÐRÚNMARK</span></h1>
            </div>
            <div className="mt-6 flex w-0 min-w-full items-center gap-4">
              <div aria-hidden="true" className="w-[250px] min-w-0 flex-auto border-t border-white/15" />
              <p className="shrink-0 pb-1 text-sm leading-[10px] tracking-wider text-[#bfb8ae]">Click to view</p>
            </div>
          </div>

          <div
            ref={panelRefs}
            className="flex h-[calc((100cqw_-_24px)*32/27)] items-stretch gap-2 md:h-[calc((100cqw_-_48px)*592/603)] md:gap-4"
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const next = (active + (event.key === "ArrowRight" ? 1 : -1) + images.length) % images.length;
              setActive(next);
              panelRefs.current?.querySelectorAll("button")[next]?.focus();
            }}
            onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
            onTouchEnd={(event) => {
              if (touchX.current !== null) {
                const difference = event.changedTouches[0].clientX - touchX.current;
                if (Math.abs(difference) > 45) move(difference < 0 ? 1 : -1);
              }
              touchX.current = null;
            }}
          >
            {images.map((image, index) => (
              <ImagePanel key={image.src} {...image} active={index === active} onSelect={() => setActive(index)} />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 md:gap-6">
              <span className="text-sm text-[#e5d2b4]">{images[active].number}<span className="ml-2 text-[#aaa397]">/ 04</span></span>
              <div className="flex gap-1" aria-label="Choose a portrait">
                {images.map((image, index) => (
                  <button key={image.number} type="button" aria-label={`View ${image.name}`} aria-pressed={index === active}
                    onClick={() => setActive(index)}
                    className="flex min-h-11 min-w-7 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4b889]">
                    <span className={`h-[2px] transition-all ${index === active ? "w-7 bg-[#d4b889]" : "w-4 bg-[#777168]"}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p role="status" aria-live="polite" className="sr-only">{images[active].name} selected. Character introduction updated below.</p>
        </section>

        <section
          id="character-introduction"
          aria-labelledby="character-title"
          className="mt-8 min-h-[420px] border-t border-white/15 py-12 md:min-h-[520px] md:py-16"
        >
          <div className="min-w-0 rounded-xl border border-white/15 bg-[#151515] p-6 md:p-10">
            <div className="border-b border-white/15 pb-6 md:pb-8">
              <p className="text-xs tracking-[.18em] text-[#cbb18a]">Character introduction</p>
              <h2 id="character-title" className="mt-4 text-3xl font-normal tracking-wide md:text-4xl">{images[active].title}</h2>
            </div>
            <div className="min-w-0 pt-6 md:pt-8">
              <h3 className="text-lg text-[#e5d2b4]">About {images[active].name}</h3>
              <p className="mt-5 max-w-3xl text-base leading-8 text-[#c7c0b6]">{images[active].description}</p>
              <p className="mt-8 text-xs tracking-[.12em] text-[#cbb18a]">Content forthcoming</p>
            </div>
          </div>
        </section>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pb-8 pt-5 text-xs tracking-wider text-[#b9b1a5]">
          <span>Discover kindred souls in light and shadow.</span>
          <span className="tracking-[.18em]">A CURATED VISUAL COLLECTION</span>
        </footer>
      </div>
    </main>
  );
}
