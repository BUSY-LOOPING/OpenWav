import { describe, expect, it } from 'vitest';
import { parseCount, pickTop, rankSongs, songsBeside } from '../src/lib/relevance.js';

const song = (title, artists, views, extra = {}) => ({ type: 'song', videoId: title, title, artists, views, ...extra });

describe('search relevance', () => {
  it('parses YouTube view counts', () => {
    expect(parseCount('2.3B')).toBe(2.3e9);
    expect(parseCount('126M')).toBe(126e6);
    expect(parseCount('1,234')).toBe(1234);
    expect(parseCount(null)).toBe(0);
  });

  it('puts the original above covers and sped-up uploads and drops duplicates', () => {
    const ranked = rankSongs('blinding lights', [
      song('Blinding Lights (Sped Up)', ['Some Channel'], '90M'),
      song('Blinding Lights', ['Karaoke King'], '1M', { title: 'Blinding Lights (Karaoke Version)' }),
      song('Blinding Lights', ['The Weeknd'], '3.7B'),
      song('Blinding Lights', ['The Weeknd'], '10M'),
    ]);
    expect(ranked.map((s) => [s.title, s.artists[0]])).toEqual([
      ['Blinding Lights', 'The Weeknd'],
      ['Blinding Lights (Sped Up)', 'Some Channel'],
      ['Blinding Lights (Karaoke Version)', 'Karaoke King'],
    ]);
    expect(rankSongs('blinding lights sped up', [song('Blinding Lights', ['The Weeknd'], '3.7B'), song('Blinding Lights (Sped Up)', ['X'], '90M')])[0].title).toBe('Blinding Lights (Sped Up)');
  });

  it('prefers an exact artist, then an exact album over a loose song, then the best song', () => {
    const artists = [{ type: 'artist', name: 'Taylor Swift Tribute' }, { type: 'artist', name: 'Taylor Swift' }];
    expect(pickTop('taylor swift', { songs: [song('Love Story', ['Taylor Swift'], '1B')], videos: [], albums: [], artists }).name).toBe('Taylor Swift');
    const albums = [{ type: 'album', title: 'Thriller' }];
    expect(pickTop('Thriller', { songs: [song('Beat It', ['Michael Jackson'], '2B')], videos: [], albums, artists: [] }).type).toBe('album');
    expect(pickTop('thriller', { songs: [song('Thriller', ['Michael Jackson'], '1B')], videos: [], albums, artists: [] }).type).toBe('song');
    expect(pickTop('x', { songs: [], videos: [], albums: [], artists: [] })).toBeNull();
  });

  it('shows the artist’s own songs beside an artist result', () => {
    const songs = [song('A', ['Other'], '1'), song('B', ['Taylor Swift'], '1'), song('C', ['Taylor Swift', 'X'], '1')];
    expect(songsBeside({ type: 'artist', name: 'Taylor Swift' }, songs).map((s) => s.title)).toEqual(['B', 'C']);
    expect(songsBeside(songs[0], songs, 1).map((s) => s.title)).toEqual(['B']);
  });
});
