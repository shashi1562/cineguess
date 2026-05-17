export const moviesByLanguage = {
  english: [
    "Inception", "The Dark Knight", "Forrest Gump", "The Godfather",
    "Schindlers List", "The Shawshank Redemption", "Interstellar", "Pulp Fiction",
    "Fight Club", "The Matrix", "Joker", "Avengers", "Titanic", "Gladiator",
    "Gravity", "La La Land", "Parasite", "Knives Out", "Oppenheimer", "Barbie",
    "The Revenant", "Braveheart", "Jaws", "Alien", "Rocky", "Jurassic Park",
    "The Silence of the Lambs", "Good Will Hunting", "Eternal Sunshine of the Spotless Mind",
    "Mad Max Fury Road", "Get Out", "Hereditary", "Midsommar", "Top Gun Maverick",
    "Spider Man No Way Home", "Black Panther", "Guardians of the Galaxy",
    "Everything Everywhere All at Once", "The Batman",
  ],

  hindi: [
    "Sholay", "3 Idiots", "Dangal", "Lagaan", "PK",
    "Dil Chahta Hai", "Mughal E Azam", "Kabir Singh", "Taare Zameen Par",
    "Queen", "Barfi", "Andhadhun", "Gangs Of Wasseypur",
    "Dilwale Dulhania Le Jayenge", "Kuch Kuch Hota Hai",
    "Rang De Basanti", "Bajrangi Bhaijaan", "Uri The Surgical Strike",
    "Article 15", "Zindagi Na Milegi Dobara", "Dil Dhadakne Do",
    "Kahaani", "Piku", "Tumhari Sulu", "Raazi", "Super 30",
    "Stree", "Bhediya", "Pathaan", "Jawan", "Animal",
  ],

  telugu: [
    "RRR", "Baahubali The Beginning", "Baahubali The Conclusion",
    "Magadheera", "Arjun Reddy", "Pushpa The Rise", "Pushpa The Rule",
    "Ala Vaikunthapurramuloo", "Geetha Govindam", "Vikram Vedha",
    "Jersey", "Sye Raa Narasimha Reddy", "Pokiri", "Okkadu",
    "Gangotri", "Sainikudu", "Bommarillu", "Julayi",
    "Race Gurram", "Athadu", "Simhadri", "Temper",
    "Dookudu", "Srimanthudu", "Bharat Ane Nenu",
    "Vakeel Saab", "Bheemla Nayak", "Karthikeya 2",
    "Dasara", "Hanu Man",
  ],

  tamil: [
    "Vikram", "Enthiran", "96", "Mersal", "Kaithi",
    "Master", "Vinnaithaandi Varuvaayaa", "Soorarai Pottru",
    "Ponniyin Selvan", "Varisu", "Kaaka Muttai",
    "Pariyerum Perumal", "Thani Oruvan", "Thevar Magan",
    "Baasha", "Thalapathy", "Anniyan", "Ghilli",
    "Sivaji The Boss", "Kadal", "Minnale",
    "Vada Chennai", "Peranbu", "Super Deluxe",
    "Jailer", "Leo", "Thunivu", "Viduthalai", "Kanguva",
  ],

  kannada: [
    "KGF Chapter One", "KGF Chapter Two", "Kantara",
    "Mungaru Male", "Mugulu Nage", "Lucia",
    "Simple Aaagi Ondu Love Story", "Godhi Banna Sadharana Mykattu",
    "Ulidavaru Kandante", "Ricky", "Kirik Party",
    "Rajaratha", "Tagaru", "Pailwaan", "Roberrt",
    "Vikrant Rona", "777 Charlie", "James",
    "Bagheera", "UI",
  ],

  malayalam: [
    "Drishyam", "Premam", "Lucifer", "Joseph",
    "Kumbalangi Nights", "Jallikattu", "Minnal Murali",
    "Bangalore Days", "Maheshinte Prathikaaram",
    "Thattathin Marayathu", "Charlie", "Uyare",
    "Virus", "Drishyam 2", "Bheeshma Parvam",
    "Nna Thaan Case Kodu", "2018",
    "Varathan", "Moothon", "Churuli",
    "Manjummel Boys", "Bramayugam", "Aavesham",
    "Marco", "Kishkindha Kaandam",
  ],
}

// Flat list for any-language fallback
export const movies = Object.values(moviesByLanguage).flat()
