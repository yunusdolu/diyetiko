/*
 * Shared by the server layout and the client loader — deliberately NOT a 'use client' module:
 * imported from one, a server component would receive a client reference instead of the text.
 */

/** The loader has played in this tab. */
export const LOADER_SEEN_KEY = 'dm_loader_seen';
/** Set right before a language switch: the next page plays the loader once more, in full. */
export const LOADER_PLAY_KEY = 'dm_loader_play';

/**
 * Inline, runs before the first paint (raw HTML at the top of <body>, not next/script: that one
 * runs only after the framework loads, by which time the loader was already drawn — and then
 * cut off half-way). CSP for public pages allows inline scripts.
 *
 * 1. Decides whether the loader plays (first page of the visit, or after a language switch).
 * 2. After a language switch the ink cover + loader ARE the transition: the browser's own
 *    cross-document view transition is skipped (it would snapshot the old page and hold the
 *    new one back for nothing — a hitch), and its promises are caught (an aborted transition
 *    otherwise surfaces as an unhandled error).
 */
export const loaderBootScript = `try{var d=document.documentElement,s=sessionStorage,p=s.getItem('${LOADER_PLAY_KEY}');if(p)s.removeItem('${LOADER_PLAY_KEY}');if(matchMedia('(prefers-reduced-motion: reduce)').matches||(!p&&s.getItem('${LOADER_SEEN_KEY}')))d.dataset.noloader='1';addEventListener('pagereveal',function(e){var v=e.viewTransition;if(!v)return;var n=function(){};v.ready.catch(n);v.finished.catch(n);v.updateCallbackDone&&v.updateCallbackDone.catch(n);if(p)v.skipTransition()},{once:true})}catch(e){document.documentElement.dataset.noloader='1'}`;
