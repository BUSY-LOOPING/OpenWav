import type { PlaylistDetails } from "../index";

export const playlistData: PlaylistDetails = {
  id: "playlist-1",
  name: "MPlay",
  description: "A collection of my favorite tracks to get through the day. Perfect for work, study, or just vibing.",
  coverImage: "https://picsum.photos/300/300?random=1",
  creator: "Dhruv Yadav",
  creatorAvatar: "https://lh3.googleusercontent.com/a/ACg8ocK_1Y-d-9JdYpKJmnXJcR4vFfDxA_s4T2TzC2A9k4Xg=s96-c-rg-br100",
  followers: "1,234",
  totalDuration: "2 hr 15 min",
  trackCount: 42,
  isPublic: true,
  isLiked: true,
  tracks: [
    {
      id: "track-1",
      title: "Starboy",
      artist: "The Weeknd, Daft Punk",
      album: "Starboy",
      duration: "3:50",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273a048415db06a5b6fa7ec4e1a",
      dateAdded: "5 days ago",
      isLiked: true
    },
    {
      id: "track-2",
      title: "Blinding Lights",
      artist: "The Weeknd",
      album: "After Hours",
      duration: "3:20",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
      dateAdded: "1 week ago",
      isLiked: false
    },
    {
      id: "track-3",
      title: "セプテンバーさん",
      artist: "RADWIMPS",
      album: "Human Bloom",
      duration: "4:12",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273e5c7b4a3fb94c9cb4e9ed9e3",
      dateAdded: "2 weeks ago",
      isLiked: true
    },
    {
      id: "track-4",
      title: "Good 4 U",
      artist: "Olivia Rodrigo",
      album: "SOUR",
      duration: "2:58",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a",
      dateAdded: "3 weeks ago",
      isLiked: false
    },
    {
      id: "track-5",
      title: "Levitating",
      artist: "Dua Lipa",
      album: "Future Nostalgia",
      duration: "3:23",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273ef968cf0bb6e337976753de9",
      dateAdded: "1 month ago",
      isLiked: true
    },
    {
      id: "track-6",
      title: "Industry Baby",
      artist: "Lil Nas X, Jack Harlow",
      album: "MONTERO",
      duration: "3:32",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273be82673b5f79d9658ec0a9fd",
      dateAdded: "1 month ago",
      isLiked: false
    },
    {
      id: "track-7",
      title: "Heat Waves",
      artist: "Glass Animals",
      album: "Dreamland",
      duration: "3:58",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273b3e5d55ea3e3fd852c7a2bc4",
      dateAdded: "2 months ago",
      isLiked: true
    },
    {
      id: "track-8",
      title: "Stay",
      artist: "The Kid LAROI, Justin Bieber",
      album: "F*CK LOVE 3: OVER YOU",
      duration: "2:21",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273fc62b02e5989b46b0ba8cdd5",
      dateAdded: "2 months ago",
      isLiked: false
    }
  ]
};
