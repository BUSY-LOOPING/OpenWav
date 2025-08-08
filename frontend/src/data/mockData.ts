import type { Track, Playlist, User, CurrentTrack } from "../index";

export const user: User = {
  name: "Dhruv",
  avatar: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
};

export const categories = [
  "Podcasts", "Work out", "Energize", "Feel good", "Relax", 
  "Party", "Commute", "Romance", "Sad", "Focus", "Sleep"
];

export const playlists: Playlist[] = [
  { id: "1", name: "Liked music", creator: "Auto playlist", type: "auto" },
  { id: "2", name: "Mood", creator: "Dhruv Yadav", type: "user" },
  { id: "3", name: "K", creator: "Dhruv Yadav", type: "user" },
  { id: "4", name: "Episodes for later", creator: "Auto playlist", type: "auto" }
];

export const listenAgainTracks: Track[] = [
  {
    id: "1",
    title: "Mood",
    artist: "Dhruv Yadav",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuA0GuYEJ1fuLIMcOd-Ej2pjpDHlLGXvdFTSfMsZOmviHIN6i7gaO1o2TDOzKGGyFu_eatQKQ00uU-2Q1vNDtDvxzJ_nRZyy2gg_tDmhdDHDVOJL2INAeMiyDg1dfgprYyWREmCCMOc63DrLCOT2yZsqB0qWQ5MaPwWykeUKTgrcwyT3vodbqfmWdmtFsSqWO446fdtq3N31FrV60V-6tLz26Zjl1hDmtO2klaUzfrxUPWHARaCmdjAq4X30JKx_PYCP3nQT5bIEunVM",
    tracks: "2,228 tracks",
    type: "playlist"
  },
  {
    id: "2",
    title: "セプテンバーさん",
    artist: "RADWIMPS",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuDJ4WvG52TMOA5W89wjnKHuWdaqh0wvBOSIaWZJzigzxMPj3QhqcT7sli1mHUtUOmavoVjYQbTLcLYEGJFeb3UhSbJZ3DcxfzuA-p6sLVm0QEuniedHERPTV7yzPsmeDQfYKJejw6UQVF0cFMhi1OgPU1AGejqZs6qhY_ivPTIa40g9T_JsU2n8SWipyyu25_H4h9hdUbwx7k6vNJBLRFi9LddugCmre3pV1zbynrFBDOZYaKgK6n2C8jCzkNasbmZxATtZJSJDCkig",
    views: "17M views",
    type: "song"
  },
  {
    id: "3",
    title: "The Winner Is... (DeVotchKa Version)",
    artist: "DeVotchKa",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuB3jizdRE-AI8pAt91pxLLEGBII3dRJOPUu6bwqyfTZo8_UIL6vEU46mWLM9bxkdViXscN_ZC09UtThO_26iYF0UOsAbmPiGHQGQEE4Rp_kq0J6P6gXZi-alsBNWSF4Ua-YLInF9-4TwGF2G0Kap7G-_CBMTLMnb-cvV6MFphHLWfZ-UVGH-1KDf-5IbhaK7dvYGoIn-ZH9JGX_UP4m6uMNyCwuj74ecLYqnaqik_6OZnsAdJIteqM2UmTOUZaccWnsV-SPC7jtQdsN",
    type: "song"
  },
  {
    id: "4",
    title: "Bring Me To Life",
    artist: "Evanescence",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuAVdF-bS3KhY2jn8sNbYkkWqanNI5KL-qH4h9Se-sdNcg-KJCbaTATer9xHs6ZC7IJqVyR8smLSrQ2cji5Nt0txpJMRPM5cwltaKV0geKthAauK-i59h4nE26LUqKRD82rb09JKn_2RO7MyX20tlgyr49SV5j0_DauGV-g16aXbqQEX_bmF0ESx5U_TqYjSC4MPoMTx9hdbTn7MPX3FkZHkIbXTpHaGpjkULdDs4VYbQdMaB10JJnclqSaACoB0IgokMAfmGsU80vOF",
    views: "9.9M views",
    type: "song"
  },
  {
    id: "5",
    title: "好きだから。- Si (feat. Ren)",
    artist: "Yuika",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuAlznjP75jyU-94NzkMCIHEoKB1fu-9QIDjf0JxpF9WTVmEFQ7mOQGDiY9ZYIcUkCZ2mBlNlL519ows89SrXm-92l8_0T7igsN5bau2t3eRKEsCke2xrTpgwJ4IjYjDsFbEF0l3k811TdWAijWBi8ajQJFHXLMoWk1QZHJnZORHvxpZLGnb_ZNoO7bin6tFt0yQH44WdXMIolwfJG2jRXbyZ3NSHSytRvdz4F90ON-iPg7w_v_Yk7koGZ6gtb7OgESblCGcJShCf0Y_",
    type: "song"
  },
  {
    id: "6",
    title: "Song Title",
    artist: "Artist Name",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuDT1fLRNfSFMyG2UWdh1zsbE0KBQtbZXnT-IF2UbRkTtZUirBpeN3jz0FEUQAizlvtimAyQ-ddBWdBJ4urpNp3VxL4xsnYh1ol6-ZkrDIDAYiDGbL-FYx1NYIT2PsmEGpifU1FH0ruyerDxez15O861HXCtwLfDXORilzZ36ZwFwTH7PoQskb9tINs6h8RDPD447J-IQkBbb7Lc15gQ_2HNo_ervoKK6klOFOOuG0sApJTTGObmX4rlPgYCHEQT8QsafLmygFUpVbg3",
    type: "song"
  }
];

export const billboardTracks: Track[] = [
  {
    id: "7",
    title: "Top Artists",
    artist: "The most played artists right now",
    albumArt: "https://lh3.googleusercontent.com/a/ACg8ocK_1Y-d-9JdYpKJmnXJcR4vFfDxA_s4T2TzC2A9k4Xg=s96-c-rg-br100",
    type: "playlist"
  },
  {
    id: "8",
    title: "Top Songs",
    artist: "The most played songs right now",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuDT1fLRNfSFMyG2UWdh1zsbE0KBQtbZXnT-IF2UbRkTtZUirBpeN3jz0FEUQAizlvtimAyQ-ddBWdBJ4urpNp3VxL4xsnYh1ol6-ZkrDIDAYiDGbL-FYx1NYIT2PsmEGpifU1FH0ruyerDxez15O861HXCtwLfDXORilzZ36ZwFwTH7PoQskb9tINs6h8RDPD447J-IQkBbb7Lc15gQ_2HNo_ervoKK6klOFOOuG0sApJTTGObmX4rlPgYCHEQT8QsafLmygFUpVbg3",
    type: "playlist"
  },
  {
    id: "9",
    title: "Trending",
    artist: "What's hot right now",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuDAihq1EDP6OAa5UzL7yyj8KBxYd_u1kjeZ4RuCxFvmdcHo-bDlEfT7buHKOV4CmOYhAC1ZYORp5e7x4VOrnAo24C5aHDJ-TqE4WwshkHWfqBMlqAaTzPXy0y44HsGls5gPEMSR6H1rpMH7ZxFSKS_iGf37hR470QUNPq14_yXy6zk6o5qxaPm5Jg66GCIlbfaOKU4lTZX8t4GXAfL7Plj_q2ErEaPCl42IUm86rioXBvqMq_msnL-i8jE0G64YOYCyHzFFB8JNSoMK",
    type: "playlist"
  },
  {
    id: "10",
    title: "New Releases",
    artist: "The latest songs and albums",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuB3jizdRE-AI8pAt91pxLLEGBII3dRJOPUu6bwqyfTZo8_UIL6vEU46mWLM9bxkdViXscN_ZC09UtThO_26iYF0UOsAbmPiGHQGQEE4Rp_kq0J6P6gXZi-alsBNWSF4Ua-YLInF9-4TwGF2G0Kap7G-_CBMTLMnb-cvV6MFphHLWfZ-UVGH-1KDf-5IbhaK7dvYGoIn-ZH9JGX_UP4m6uMNyCwuj74ecLYqnaqik_6OZnsAdJIteqM2UmTOUZaccWnsV-SPC7jtQdsN",
    type: "playlist"
  }
];

export const forgottenFavorites: Track[] = [
  {
    id: "11",
    title: "오리지널 사운드트랙",
    artist: "Various Artists",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuAXMgkzz30bvg1kQTmB8FXeTJI-PFibs00DEe4kuyKJRUu2E2gJh4sWzwjNJmb25YqHtMgMlCGDSGZMLU64UJHbrNLHyKC35DcpLJ8g8_-x11ddjktJ7Bv3nwfL8NpRfQoNp9MaWG5XHFi1kDPabMw_7wTfdpK-xN2wwwVQxWcLf2iYvWQgriF-YF8Qbz3YlNmz-953-sRU8E6HI7tT4DZJitVUcx8fIII8Fb_ErhEsZFfTVFtDWPidF2WrUQUmpp2fBiObAAhfQf89",
    type: "album"
  },
  {
    id: "12",
    title: "Iron Feather",
    artist: "Artist Name",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuDAihq1EDP6OAa5UzL7yyj8KBxYd_u1kjeZ4RuCxFvmdcHo-bDlEfT7buHKOV4CmOYhAC1ZYORp5e7x4VOrnAo24C5aHDJ-TqE4WwshkHWfqBMlqAaTzPXy0y44HsGls5gPEMSR6H1rpMH7ZxFSKS_iGf37hR470QUNPq14_yXy6zk6o5qxaPm5Jg66GCIlbfaOKU4lTZX8t4GXAfL7Plj_q2ErEaPCl42IUm86rioXBvqMq_msnL-i8jE0G64YOYCyHzFFB8JNSoMK",
    type: "song"
  },
  {
    id: "13",
    title: "There For You",
    artist: "Artist Name",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuCd34nRMyu0dv7Rn75yXI1LU8nDxh3FBFTJEoDyJZ2lEnP4yPnCPz44XS8CSbO84jIAWAyBFVZpHQUvCwsxo37sVze9Dc9HE6VV4HGTzKVsuYncKUOYHv_VrtAigDqKXI3XO80tJiBcs9WcbrNMhE2gSlNbisyOIBn7vWIhaRXFYSpV-QhqNePCot-CXAO6WdLGNXnvfSxe5GjVT1Oc6Pf5pg_s9qhvKDP-GGAk7cNHFC3Ae9uu8L1NFChvlUmyxx2frcgI8ZR4Weq-",
    type: "song"
  },
  {
    id: "14",
    title: "Liqüid",
    artist: "Artist Name",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuAJ-eMFTtbimtx9Y0ijiA8zkAG8phf_XiiUhYsBKp1xOlL5VxItkVRkmqiTzVEG1ZhYtR87UZxdiV0e_Rofi_z0hYdsJSD3_Fd5O3J-JXfC1V__Sx8bjNSJVZWBuJaIKoZop0Gg7tvEUFyEwSbThMVA2_ufU6KLzXQeX7CBnU9rf4imzsVT9QQbXY5GdHk1OeGMYPVujWVbvDedsNPVRllcSsa1Y-w1gjZ8Nl16z_123_g9GqnYwCwy-nRebfmXXxyjo96MQAOqHP_y",
    type: "song"
  },
  {
    id: "15",
    title: "boa para meu treino",
    artist: "Playlist",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuDQqcT9oStuVYA96sOSaXZjW5OZcWfHQiBcz843R1UGVzndKj1AiJ5ZXPTzbe56toFsGIuPzKfEoQNCP_RJO61w3LlAfgfBAeq_z-tlI5F33ISg_F8huFQP43c6kS-MVjkhvtLMbkruQaBCR-VAX4-SBmeqyBf134i6LCSozv2sMQz6cQvJxH86HavndWt2IsdiufGs56eSxDTJ8sdOWaaC90kYNIvfSXmTgvm5fpdFvLiTZl4_RmgPxQYludAn5YstpWS6IMkOKktP",
    type: "playlist"
  },
  {
    id: "16",
    title: "Afiaonse",
    artist: "Playlist",
    albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuB5-0P4OOaC4JB6HBSh3REPtXosTKXJLihKZJdojFvzSCvXoq6bRELAY0_gV_m649H07z_Vx5CqR8L7kscqF1nKwDLl0fpTxTmE3NJgKaxtc1zR2yzrM3VfzAWlkILYQFfSDIdmFURb5hzutU2G4Y98BGovNNLYBWhEEverAFyUw7moq7d8sz9anpRHaUHmxRXJx3EDKCJo1I9_dYmaNogO9c-53c3m6HqxoCw3wTQMqXgwDMLaLBsFsS4GA3nnpAhRXHr74q_vpWmS",
    type: "playlist"
  }
];

export const currentTrack: CurrentTrack = {
  title: "Starboy",
  artist: "The Weeknd, Daft Punk",
  albumArt: "https://lh3.googleusercontent.com/aida-public/AB6AXuA0GuYEJ1fuLIMcOd-Ej2pjpDHlLGXvdFTSfMsZOmviHIN6i7gaO1o2TDOzKGGyFu_eatQKQ00uU-2Q1vNDtDvxzJ_nRZyy2gg_tDmhdDHDVOJL2INAeMiyDg1dfgprYyWREmCCMOc63DrLCOT2yZsqB0qWQ5MaPwWykeUKTgrcwyT3vodbqfmWdmtFsSqWO446fdtq3N31FrV60V-6tLz26Zjl1hDmtO2klaUzfrxUPWHARaCmdjAq4X30JKx_PYCP3nQT5bIEunVM",
  currentTime: "1:24",
  totalTime: "3:50",
  progress: 33
};
