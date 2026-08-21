import { ownEntry } from "../lookup.js";

// Look library.
//
// A look is a photographic medium at a moment in time, carrying every
// consequence of that medium. It is not a mood, not a filter, and not a set of
// imperfections sprinkled over a clean render. The reference images that drove
// this file are a 1990s drugstore print, a mid 1970s color slide, and a 1970s
// consumer color negative at dusk. What makes each unmistakable is not that it
// is flawed. It is that every attribute agrees: the light source, the color
// response, the grain structure, the tonal curve, the resolution, and what the
// medium physically cannot do.
//
// This is code, not configuration, per ADR 0018: the library is code, a brand's
// slate is governed configuration, and selection is a later question. Nothing
// here is synthesized from a brand's sources, because no brand's sources
// document camera character.
//
// Register rule, from the 2026-08-17 audit: every clause states a visible
// consequence. This renderer obeys physical facts and ignores perceptual
// targets, so "grain clumps in the midtones" is usable and "authentic" is not.
//
// Every look states what the medium cannot do, because that is what separates
// a medium from a mood. A frame that can do everything is the default render.
//
// `resolvesFineDetail`, added 2026-08-18. Some media cannot render a hair, a
// thread, or a fiber in an iris, and three looks here say so in their own
// lines. The human texture floor asks for exactly those things, so a look that
// cannot deliver them and a floor that demands them are two statements in the
// Capture section making competing claims about the same property. A look
// declares `resolvesFineDetail: false` and the floor compiles without its
// fine-detail clauses. Absent, the field reads as true, because resolving fine
// detail is what most media do.
//
// `consumer_negative_dusk` was raised as a finding when the field was added and
// flagged by owner ruling of 2026-08-18 on the same evidence as the other
// three: its own line states coarse grain across the entire frame, approximate
// focus rather than exact focus, and precise focus as outside what the medium
// does. Four looks now carry the flag.

export const LOOKS = {
  film_noir: {
    id: "film_noir",
    label: "Film noir",
    environment: "agnostic",
    line:
      "Black and white, no color anywhere in the frame. One hard light source, small and undiffused, placed high and to one side and well off the camera axis, throwing hard edged shadows with sharp boundaries rather than soft falloff. Nothing fills the shadow side: the unlit half of every face goes to solid black and stays there, and large areas of the frame hold no detail at all. The tonal curve is steep and the midtones are squeezed out, so surfaces are either bright or gone. Highlights on skin and metal clip to pure white. Shadow patterns from window blinds, railings, banisters, or foliage fall across walls, floors, and faces and are as much the subject as the person. Grain is coarse and clumped, heaviest in the greys. Deep focus holds the foreground and the far wall together rather than separating them. The camera sits low and tilts up, or high and looks down, and the horizon is not level. Fill light, even illumination, and a fully legible frame are all outside what this medium does.",
  },

  drugstore_flash: {
    id: "drugstore_flash",
    label: "Drugstore flash print",
    environment: "agnostic",
    resolvesFineDetail: false,
    line:
      "A direct on camera flash fired straight at the subject from the camera position, the only meaningful light in the frame. Faces are flat and evenly blasted with no shaping, the nearest surfaces are overexposed toward white, and everything beyond about eight feet falls off into underexposed murk. A hard shadow sits on the wall directly behind each subject, low and offset. The lens is a fixed wide angle and mildly distorts anything near the edges. Color is a machine print from a consumer lab: skin runs warm and slightly orange, whites carry a magenta or yellow cast, blacks are milky rather than deep, and the whole frame sits in a narrow contrast range. Grain is fine but the resolution is soft, so hair and fabric edges never fully resolve and small background detail turns to mush. Subjects face the camera and know they are being photographed. Shallow depth of field, shaped light, and a clean neutral white balance are all outside what this medium does.",
  },

  color_slide_1975: {
    id: "color_slide_1975",
    label: "Color slide, mid seventies",
    environment: "binding",
    requires: "bright direct sun, outdoors or through a window",
    line:
      "Daylight color reversal film in bright direct sun. Color is far denser than life: reds are heavy and slightly orange, blues are deep and almost inky, greens turn yellow, and skin carries a strong amber weight that no white balance corrects. The tonal range is punishing and narrow. Anything in direct sun that is bright clips to blank paper white with no detail inside it at all, and every shadow, including the shaded side of a face, falls to a heavy near black carrying a faint blue green tint, with nothing recoverable at either end and almost nothing in between. Bright areas bloom into whatever sits beside them, so lit edges glow and lose their boundary. Tight grain is visible in flat sky and in skin. The lens flares readily, dropping veiled patches and faint rings across the frame when the sun is near the edge. Sharpness is moderate and falls off toward the corners. Wide dynamic range, neutral color, recoverable shadows, and any gentle transition from light to dark are all outside what this medium does.",
  },

  consumer_negative_dusk: {
    id: "consumer_negative_dusk",
    label: "Consumer negative at dusk",
    environment: "binding",
    requires: "failing daylight outdoors or a space open to it, at dusk",
    resolvesFineDetail: false,
    line:
      "Fast consumer color negative film shot in failing light, pushed a stop past where it wanted to be. The whole frame carries a single warm orange cast that is never corrected, and the shadows lift into a muddy brown rather than reaching black. Grain is coarse and obvious across the entire frame, heaviest in the sky and in flat skin, and it is part of the surface rather than an overlay. Color saturation is low and the palette collapses toward amber, so a red and a brown read as neighbors. Highlights from any small bright source bloom into soft halos with visible fringing at their edges. Focus is approximate: the subject is close to sharp rather than exactly sharp, and anything moving smears. Detail in dark clothing and dark foliage is simply absent. Contrast is low and the image feels slightly flat and slightly veiled, as though a thin fog sits over it. Clean color, tight grain, and precise focus are all outside what this medium does.",
  },

  large_format_daylight: {
    id: "large_format_daylight",
    label: "Large format daylight",
    environment: "binding",
    requires: "daylight, and a subject that can hold still on a tripod",
    line:
      "A single large sheet of film exposed on a view camera, on a tripod, at a small aperture. Resolution is extreme and even: individual fibers in fabric, pores in skin, grain in wood, and lettering far into the background are all legible, and grain is nearly invisible. Tonality is long and smooth, holding detail in the brightest windows and the deepest shadows at once, with gradations that step gently rather than snapping. Light is whatever daylight is present, directional and unmodified, with soft edged shadows. Color is accurate and restrained rather than saturated. The subject is still, because the exposure was long enough to require it, and anything that moved has smeared into a soft transparent trace. Perspective lines are corrected and vertical. Handheld immediacy, shallow separation, and a caught unrepeatable moment are all outside what this medium does.",
  },

  // Neutral is the default and the only entry with no era, no stock, and no
  // color personality, so it never reads as a filter over the work. It is what
  // a person means when they ask for something clean and professional.
  //
  // It replaced two earlier entries on 2026-08-18. `studio_seamless_flash` was
  // removed because it fought world building rather than styling it, and
  // `clean_digital` was absorbed after losing to this look on both an interior
  // with a hard source and an exterior with none. Two entries whose only
  // difference is that one is weaker is not a spectrum, it is a worse option
  // sitting on the menu.
  //
  // The reference set was high end commercial portraiture. Three of its
  // clauses existed in no earlier look: the light has a position in the room
  // rather than only on the face, the person carries age and asymmetry rather
  // than only texture, and nobody tidied the set. The strobe language proved
  // to describe behavior rather than demand equipment: on an exterior with no
  // hard source it produced found dappled light with correct falloff rather
  // than inventing a light stand.
  neutral: {
    id: "neutral",
    label: "Neutral",
    environment: "agnostic",
    line:
      "One strobe through a large modifier, placed off the lens axis and close enough that its falloff is visible, in a real room that was not built for photography. The light has a position in the room and the frame lets you find it: surfaces nearest it are correctly exposed, surfaces a few feet further are darker, and one side of the room goes nearly black while the other holds detail. The background sits two to three stops under the subject and gets there by distance from the light rather than by blur. A soft but definite shadow edge runs along the nose, under the chin, and down every fold of fabric, and nothing fills the shadow side except what the room itself returns. The person is a specific age and the frame says so, in the hair, the weathering, and the way the body carries itself. Hair, collar, lapel, and cuff each sit differently on the left and the right. Each material answers the light in its own way: leather returns broad soft speculars that wrap and show the roll of the surface, polished wood carries a directional sheen along the grain, wool and tweed show their weave and the break over an elbow, denim shows whiskering at the hip and stacking at the ankle, and cotton holds the creases of having been worn. The room is not tidied for the camera, so an outlet, a cable along the baseboard, worn carpet, or a scuffed leg stays in frame where it actually is. A long lens compresses the space, so nothing widens or stretches at the edges even when the whole body is in frame. The subject holds the camera without smiling. Even room illumination, a cleaned set, a flawless ageless face, and wide angle proximity are all outside what this way of working produces.",
  },

  overcast_editorial: {
    id: "overcast_editorial",
    label: "Overcast daylight editorial",
    environment: "binding",
    requires: "outdoors under a fully overcast sky, in daylight",
    line:
      "Open shade under a fully overcast sky, which is one enormous soft source directly above. Shadows are present but very soft, deepest under the chin, the brow, and anywhere fabric folds. Contrast is low and the whole tonal range sits in the middle, with no clipped highlight and no blocked black anywhere in the frame. Color is cool and slightly desaturated: skin runs neutral to faintly pink, whites read very slightly blue, and greens are muted rather than vivid. A fast lens wide open holds the face sharp and lets everything past the subject dissolve into soft undifferentiated tone. Hair moves and some of it crosses the face rather than being cleared away. Fabric shows its weave and its creases. Fine grain sits evenly across the frame. Hard shaped light, deep shadow, and high saturation are all outside what this condition provides.",
  },

  anamorphic_widescreen: {
    id: "anamorphic_widescreen",
    label: "Anamorphic widescreen film",
    environment: "agnostic",
    line:
      "Anamorphic lenses on motion picture film, which leave two artifacts that must both be visible in the frame. First, every out of focus highlight behind the subject renders as a tall vertical oval, clearly stretched rather than round: string lights, streetlights, sun through leaves, and reflections all become ovals. Second, at least one bright source draws a long thin horizontal streak of flare running straight across the frame through the subject, wider than it is tall, in blue or amber. The center is sharp and the far left and right edges are visibly softer and slightly stretched, so anything near the side edges distorts. Depth is very shallow, so the subject separates hard from a background that dissolves entirely. Color is warm with reds and skin favored, blacks lifted to a soft charcoal rather than absolute, and highlights rolling off without clipping. Fine grain sits over everything. Round bokeh, a clean flare free frame, and edge to edge sharpness are all outside what this format does.",
  },

  bleach_bypass_90s: {
    id: "bleach_bypass_90s",
    label: "Bleach bypass, nineties",
    environment: "agnostic",
    resolvesFineDetail: false,
    line:
      "Color film processed with the silver left in, which lays a hard black and white image over a weakened color one. The frame reads as black and white at first glance, and only on looking does any color appear at all: a single strong red or an orange package holds a trace of hue and every other surface, including skin, foliage, denim, and sky, is grey. Skin is grey with only the faintest warmth. Contrast is severe: bright surfaces go to blank white and shadows go to black, both holding nothing, and the darker midtones carry a distinct cold cyan or green tint that is visible as a color cast on grey. Grain is coarse and everywhere, heaviest in flat areas. Faces look pale and hard, with blemishes, stubble, and veins reading clearly. Light is whatever the room has, usually overhead, and nothing is filled. Recognizable color, gentle tonal transitions, and clean shadows are all outside what this process does.",
  },

  flash_night_street: {
    id: "flash_night_street",
    label: "Flash on a night street",
    environment: "binding",
    requires: "outdoors after dark, with distant lights but no ambient fill",
    line:
      "A powerful flash fired at a subject standing on a street after dark, with a shutter too fast to record much of the ambient city behind them. The subject is lit hard and cleanly with a crisp shadow edge, and everything more than a few feet beyond falls to deep black with only streetlights, windows, and wet reflections surviving as small bright points. Wet pavement returns the flash as hard specular streaks. The color is split: the subject reads neutral or cool from the flash while distant lights burn warm orange or green against the black. Blacks are absolutely black and hold nothing. Skin is rendered with high clarity, every texture and stray hair caught by the light. The subject is aware of the camera and is composed for it. Ambient atmosphere, soft gradation, and a legible background are all outside what this technique does.",
  },

  pushed_bw_reportage: {
    id: "pushed_bw_reportage",
    label: "Pushed black and white reportage",
    environment: "agnostic",
    resolvesFineDetail: false,
    line:
      "Black and white, no color anywhere in the frame. Fast film rated three stops past its speed and developed long to compensate, and the grain is the first thing anyone notices about the picture. Grain reads as distinct visible specks across every surface, coarse enough that individual hairs, fabric threads, and small background detail do not resolve into anything but texture. Flat areas like skin, sky, and painted walls are the grainiest parts of the frame, not the cleanest. Contrast is severe and the midtones are nearly gone: skin is either bright or dark with little between, highlights go to blank white with no detail, and shadows go to black with no detail. Edges look slightly rough rather than crisp. The light is whatever the room or street provided from a single direction, and nothing is filled. Smooth tonality, clean skin, resolved fine detail, and any grey that sits comfortably in the middle are all outside what this treatment does.",
  },

  saturated_daylight_adventure: {
    id: "saturated_daylight_adventure",
    label: "Saturated daylight, outdoors",
    environment: "binding",
    requires: "outdoors in clear direct sun, with open sky in frame",
    line:
      "Bright direct sun in clear high altitude or coastal air, shot on a small aperture for depth. Color is deeply saturated with the sky rendering a dense blue that darkens toward the top of the frame, and a single piece of high visibility clothing carrying the only warm color against it. Contrast is high and shadows are hard edged and short, because the sun is high. Everything from the subject to the far ridge line is in focus and legible. Detail is extreme: snow texture, rock grain, and the weave of technical fabric all resolve. Grain is nearly absent. Highlights on snow, water, and ice clip to pure white in the brightest specular areas. The subject is small in the frame and the environment is the larger part of the picture. Shallow depth, soft light, and muted color are all outside what these conditions give.",
  },

  daylight_street_documentary: {
    id: "daylight_street_documentary",
    label: "Daylight street documentary",
    environment: "binding",
    requires: "a city street in full daylight, with traffic and passersby present",
    line:
      "Ordinary daylight on a city street, sun somewhere off to one side and not managed in any way. Some surfaces are in hard sun and others are in the shade of buildings within the same frame, and the exposure favors the subject so the sunlit areas run bright and the shaded areas run dark. Color is accurate rather than graded, and the frame carries whatever colors the street contains: signage, painted walls, car paint, all competing rather than harmonized. Depth is moderate, so the subject is sharp and the traffic and passersby behind them are soft but still identifiable. People in the background are caught mid stride, mid gesture, or looking somewhere other than at the camera, and at least one is partly cut by a pole, a car, or the frame edge. Grain is fine and present. The subject is walking and is photographed from the front at a distance. Controlled light, a clean background, and a harmonized palette are all outside what a street provides.",
  },

  // Added 2026-08-18 from the photographic character layer brief r2, which
  // proposed these two among its capture profiles. They arrive as looks rather
  // than as a parallel profile system, because the library already is the
  // place a medium is described and a second system describing the same
  // property is the conflict shape ADR 0018 removes.
  color_negative_daylight: {
    id: "color_negative_daylight",
    label: "Color negative, handheld",
    environment: "agnostic",
    line:
      "Handheld 35mm color negative film in whatever light the day provides. Fine organic grain is visible in the shadows and the sky and rises anywhere underexposed. Highlights roll off softly rather than clipping, and may blow gently on bright metal or pale skin. Color responds like film: greens lean toward olive, skin sits warm, whites go cream rather than pure. Exposure favors the subject and lets the rest of the frame fall where the light puts it, so some of the frame runs dark or bright without correction. The horizon may sit a degree or two off level and the framing is loose rather than measured. One element of the frame may be imperfect: a soft foreground edge, a small flare from the light source, a background detail smeared by motion. Even illumination, corrected color, level measured framing, and a noiseless file are all outside what this medium does.",
  },

  long_lens_distance: {
    id: "long_lens_distance",
    label: "Long lens, from a distance",
    environment: "agnostic",
    line:
      "A 135 to 200mm lens from well back, so perspective is compressed and the background planes stack close behind the subject rather than receding. Focus is one thin plane; everything before and behind it falls away quickly, and a foreground element may cross the frame soft and unexplained. On exteriors, atmospheric haze reads between the stacked planes, lightening and cooling each one further back. The palette is muted and earthy in the register of 1970s color negative: ochres, browns, sage greens, low contrast, soft highlight falloff. Organic grain sits throughout and is heavier in the sky. Wide framing, edge-to-edge sharpness, punchy saturation, and an intimate close camera are all outside what this way of working does.",
  },

  available_light_interior: {
    id: "available_light_interior",
    label: "Available light interior",
    environment: "binding",
    requires: "indoors, with one window as the only light",
    line:
      "One window is the only light in the room and nothing else is added. Surfaces facing the window are correctly exposed and everything turned away from it falls off steeply, so the far side of the room reads two or three stops down and holds little detail. The light is soft edged but strongly directional, and its color comes from what is outside: cool blue on an overcast day, warm on a low sun, green where it passes through foliage. Shadows on the wall carry color bounced from whatever is near them. The lens is fast and wide open, so one plane is sharp and everything else falls away quickly, with background highlights rendering as soft rounded shapes. Grain sits in the shadows and underexposed areas and is absent from the lit surfaces. Highlights on the window frame and any glass clip and hold nothing. Even illumination, recovered shadow detail, and a neutral color balance are all outside what this medium does.",
  },
};

// Derived, so a new entry in LOOKS reaches this list by being written above.
// The picker order in app/app.js is curated separately and runs from the
// cleanest options to the most extreme; nothing validates that the two files
// carry the same ids, so both are checked by hand when a look is added.
export const LOOK_IDS = Object.keys(LOOKS);

/**
 * Resolve a look by id. Returns null for an unknown or absent id, which is the
 * signal to compile the shared capture floor instead.
 */
export function resolveLook(id) {
  if (!id) return null;
  // Own entries only, through the shared guard. Nothing validates brief.look
  // against this library and the field is reachable through the API with any
  // string, so an id like constructor used to resolve an inherited function,
  // pass the truthiness fallback, and leave the compile path reading .line off
  // something that has no .line. Do not simplify this back to LOOKS[key]:
  // an unknown id must fall back to the shared capture floor exactly as an
  // absent id does. See src/lookup.js for the full account.
  return ownEntry(LOOKS, id);
}

/**
 * Whether the selected medium can render a hair, a thread, or a fiber in an
 * iris. No look means the shared capture floor, which claims no such limit.
 */
export function lookResolvesFineDetail(look) {
  if (!look) return true;
  return look.resolvesFineDetail !== false;
}
