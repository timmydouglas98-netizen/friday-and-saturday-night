  "use strict";

  // ---------- Sample shelf (used when the live Stremio catalog can't be reached) ----------
  // id, title, year, genres, minutes, director, cast, blurb
  var SAMPLE = [
    ["tt0133093","The Matrix",1999,["Sci-Fi","Action"],136,"Lana & Lilly Wachowski","Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss","A hacker learns the world he lives in is a simulation and joins the rebels fighting the machines that run it."],
    ["tt0107290","Jurassic Park",1993,["Sci-Fi","Adventure"],127,"Steven Spielberg","Sam Neill, Laura Dern, Jeff Goldblum","A theme park of cloned dinosaurs opens early for a weekend of inspectors. The fences do not hold."],
    ["tt0103064","Terminator 2: Judgment Day",1991,["Action","Sci-Fi"],137,"James Cameron","Arnold Schwarzenegger, Linda Hamilton, Edward Furlong","A reprogrammed cyborg is sent back to protect a teenage boy from a newer, liquid-metal model."],
    ["tt0110912","Pulp Fiction",1994,["Crime","Drama"],154,"Quentin Tarantino","John Travolta, Samuel L. Jackson, Uma Thurman","Hitmen, a boxer and a gangster's wife cross paths across a few days in Los Angeles, told out of order."],
    ["tt0099785","Home Alone",1990,["Family","Comedy"],103,"Chris Columbus","Macaulay Culkin, Joe Pesci, Daniel Stern","An eight-year-old left behind at Christmas defends the house against two burglars with household traps."],
    ["tt0107048","Groundhog Day",1993,["Comedy","Romance"],101,"Harold Ramis","Bill Murray, Andie MacDowell","A grumpy weatherman relives the same February day in a small town until he gets it right."],
    ["tt0117571","Scream",1996,["Horror","Thriller"],111,"Wes Craven","Neve Campbell, Courteney Cox, David Arquette","A masked killer who quizzes victims on horror trivia stalks the teenagers of a quiet California town."],
    ["tt0111257","Speed",1994,["Action","Thriller"],116,"Jan de Bont","Keanu Reeves, Sandra Bullock, Dennis Hopper","A bus is rigged to explode if it drops below fifty miles an hour. A SWAT cop has to keep it moving."],
    ["tt0114709","Toy Story",1995,["Family","Animation"],81,"John Lasseter","Tom Hanks, Tim Allen","A pull-string cowboy feels threatened when a flashy space ranger becomes his kid's new favourite toy."],
    ["tt0087332","Ghostbusters",1984,["Comedy","Sci-Fi"],105,"Ivan Reitman","Bill Murray, Dan Aykroyd, Sigourney Weaver","Three out-of-work parapsychologists start a ghost removal business just as New York gets haunted."],
    ["tt0088763","Back to the Future",1985,["Sci-Fi","Comedy"],116,"Robert Zemeckis","Michael J. Fox, Christopher Lloyd","A teenager is sent thirty years into the past in a DeLorean and has to make sure his parents fall in love."],
    ["tt0112697","Clueless",1995,["Comedy","Romance"],97,"Amy Heckerling","Alicia Silverstone, Paul Rudd","A popular Beverly Hills student plays matchmaker for her classmates and misses what's in front of her."],
    ["tt0110475","The Mask",1994,["Comedy","Family"],101,"Chuck Russell","Jim Carrey, Cameron Diaz","A mild bank clerk finds an ancient mask that turns him into a cartoonish, unstoppable trickster."],
    ["tt0102685","Point Break",1991,["Action","Crime"],122,"Kathryn Bigelow","Keanu Reeves, Patrick Swayze","An FBI rookie goes undercover with a crew of surfers he suspects are robbing banks."],
    ["tt0100814","Tremors",1990,["Horror","Comedy"],96,"Ron Underwood","Kevin Bacon, Fred Ward","Two handymen in a desert town discover giant worms hunting by vibration under the ground."],
    ["tt0095016","Die Hard",1988,["Action","Thriller"],132,"John McTiernan","Bruce Willis, Alan Rickman","An off-duty New York cop is the only one free when terrorists take over an office tower on Christmas Eve."],
    ["tt0110357","The Lion King",1994,["Family","Animation"],88,"Roger Allers & Rob Minkoff","Matthew Broderick, James Earl Jones, Jeremy Irons","A lion cub flees his kingdom after his father's death and has to come back to claim his place."],
    ["tt0116282","Fargo",1996,["Crime","Thriller"],98,"Joel Coen","Frances McDormand, William H. Macy, Steve Buscemi","A car salesman's plan to have his wife kidnapped goes badly wrong in snowbound Minnesota."],
    ["tt0113277","Heat",1995,["Crime","Action"],170,"Michael Mann","Al Pacino, Robert De Niro, Val Kilmer","A careful master thief and an obsessive LAPD detective circle each other across one last big job."],
    ["tt0113497","Jumanji",1995,["Family","Adventure"],104,"Joe Johnston","Robin Williams, Kirsten Dunst","A board game releases jungle hazards into a small town, and the only way out is to finish playing."],
    ["tt0119654","Men in Black",1997,["Sci-Fi","Comedy"],98,"Barry Sonnenfeld","Tommy Lee Jones, Will Smith","A New York cop is recruited into a secret agency that polices aliens living on Earth."],
    ["tt0120737","The Big Lebowski",1998,["Comedy","Crime"],117,"Joel Coen","Jeff Bridges, John Goodman, Julianne Moore","A laid-back bowler is mistaken for a millionaire with the same name and dragged into a kidnapping."],
    ["tt0105793","Wayne's World",1992,["Comedy"],94,"Penelope Spheeris","Mike Myers, Dana Carvey","Two metalheads with a public-access TV show get a shot at the big time from a slick producer."],
    ["tt0111161","The Shawshank Redemption",1994,["Drama"],142,"Frank Darabont","Tim Robbins, Morgan Freeman","A banker serving life for a crime he says he didn't commit finds hope and friendship over decades in prison."],
    ["tt0114369","Se7en",1995,["Crime","Thriller"],127,"David Fincher","Brad Pitt, Morgan Freeman","Two detectives hunt a killer who builds each murder around one of the seven deadly sins."],
    ["tt0100802","Total Recall",1990,["Sci-Fi","Action"],113,"Paul Verhoeven","Arnold Schwarzenegger, Sharon Stone","A construction worker buys implanted memories of a trip to Mars and finds out he may be a spy."],
    ["tt0094721","Beetlejuice",1988,["Comedy","Horror"],92,"Tim Burton","Michael Keaton, Winona Ryder, Geena Davis","A recently dead couple hire a chaotic bio-exorcist to scare the new family out of their house."],
    ["tt0087363","Gremlins",1984,["Horror","Comedy"],106,"Joe Dante","Zach Galligan, Phoebe Cates","A cute pet comes with three rules. Break them and the town fills up with mischievous monsters."],
    ["tt0107614","Mrs. Doubtfire",1993,["Comedy","Family"],125,"Chris Columbus","Robin Williams, Sally Field","A divorced dad disguises himself as an elderly Scottish nanny to spend time with his kids."],
    ["tt0117998","Twister",1996,["Action","Adventure"],113,"Jan de Bont","Helen Hunt, Bill Paxton","A team of storm chasers race across Oklahoma to put sensors inside a tornado."],
    ["tt0116629","Independence Day",1996,["Sci-Fi","Action"],145,"Roland Emmerich","Will Smith, Jeff Goldblum, Bill Pullman","Giant alien ships park over the world's cities and humanity has three days to fight back."],
    ["tt0112431","Babe",1995,["Family","Comedy"],91,"Chris Noonan","James Cromwell","A piglet raised by a sheepdog decides he can herd sheep too, politely."],
    ["tt0106977","The Fugitive",1993,["Action","Thriller"],130,"Andrew Davis","Harrison Ford, Tommy Lee Jones","A surgeon wrongly convicted of his wife's murder escapes and hunts the real killer with a marshal on his trail."],
    ["tt0102926","The Silence of the Lambs",1991,["Thriller","Horror"],118,"Jonathan Demme","Jodie Foster, Anthony Hopkins","An FBI trainee asks an imprisoned cannibal psychiatrist for help catching another killer."],
    ["tt0109445","Clerks",1994,["Comedy"],92,"Kevin Smith","Brian O'Halloran, Jeff Anderson","One very long shift at a New Jersey convenience store, and the video store next door."],
    ["tt0109686","Dumb and Dumber",1994,["Comedy"],107,"Peter Farrelly","Jim Carrey, Jeff Daniels","Two dim friends drive across the country to return a briefcase to a woman they barely know."],
    ["tt0078748","Alien",1979,["Horror","Sci-Fi"],117,"Ridley Scott","Sigourney Weaver, Tom Skerritt","A cargo crew answers a distress call and brings something back on board."],
    ["tt0081505","The Shining",1980,["Horror","Drama"],146,"Stanley Kubrick","Jack Nicholson, Shelley Duvall","A writer takes a winter caretaker job at an empty mountain hotel with his wife and son."],
    ["tt0093773","Predator",1987,["Action","Sci-Fi"],107,"John McTiernan","Arnold Schwarzenegger, Carl Weathers","A special forces team in the jungle is hunted by an invisible alien trophy hunter."],
    ["tt0097576","Indiana Jones and the Last Crusade",1989,["Adventure","Action"],127,"Steven Spielberg","Harrison Ford, Sean Connery","An archaeologist and his estranged father race Nazis to find the Holy Grail."]
  ];
  var STAFF_NOTE = "Popular on Letterboxd right now.";
  // id, title, year, genres, episode minutes, created by, cast, blurb
  var SAMPLE_TV = [
    ["tt0098904","Seinfeld",1989,["Comedy"],22,"Larry David & Jerry Seinfeld","Jerry Seinfeld, Julia Louis-Dreyfus, Jason Alexander","A comedian and his three friends turn the small annoyances of New York life into elaborate disasters."],
    ["tt0106179","The X-Files",1993,["Sci-Fi","Drama"],45,"Chris Carter","David Duchovny, Gillian Anderson","Two FBI agents, one a believer and one a sceptic, investigate cases involving the unexplained."],
    ["tt0108778","Friends",1994,["Comedy","Romance"],22,"David Crane & Marta Kauffman","Jennifer Aniston, Courteney Cox, Matthew Perry","Six friends in Manhattan get through jobs, breakups and a lot of coffee together."],
    ["tt0098936","Twin Peaks",1990,["Drama","Thriller"],47,"David Lynch & Mark Frost","Kyle MacLachlan, Sheryl Lee","An FBI agent arrives in a logging town to investigate the murder of a homecoming queen."],
    ["tt0096697","The Simpsons",1989,["Animation","Comedy"],22,"Matt Groening","Dan Castellaneta, Julie Kavner, Nancy Cartwright","A working-class family in Springfield gets into a new kind of trouble every week."],
    ["tt0118276","Buffy the Vampire Slayer",1997,["Action","Horror"],44,"Joss Whedon","Sarah Michelle Gellar, Alyson Hannigan","A high schooler balances homework with being the one girl destined to fight vampires."]
  ];
  var SEASONS = {
    9: { aisle: "Halloween Horror", c1: "#ff7a00", c2: "#5b2a86", banner: "<b>31</b><span>NIGHTS OF<br>FRIGHTS</span><em>horror all month</em>", standee: "Scariest pick",
         match: function (it) { return (it.genres || []).indexOf("Horror") !== -1; } },
    11: { aisle: "Holiday Hits", c1: "#c8102e", c2: "#1f7a3a", banner: "<b>25</b><span>DAYS OF<br>HOLIDAY HITS</span><em>family favourites</em>", standee: "Holiday pick",
          match: function (it) { return /christmas|santa|elf|grinch|holiday|home alone|die hard|gremlins|polar/i.test(it.name) || (it.genres || []).indexOf("Family") !== -1; } },
    0: { aisle: "Summer Blockbusters", c1: "#ff5a36", c2: "#1aa0c8", banner: "<b>HOT</b><span>SUMMER<br>BLOCKBUSTERS</span><em>air-conditioned fun</em>", standee: "Big summer pick",
         match: function (it) { var g = it.genres || []; return g.indexOf("Action") !== -1 || g.indexOf("Adventure") !== -1; } },
    1: { aisle: "Date Night", c1: "#e0457b", c2: "#7a1f3d", banner: "<b>2</b><span>FOR<br>DATE NIGHT</span><em>bring someone</em>", standee: "Date night pick",
         match: function (it) { return (it.genres || []).indexOf("Romance") !== -1; } }
  };
  var season = SEASONS[new Date().getMonth()] || null;
  var AISLES = [
    { key: "cw", label: "Continue Watching" },
    { key: "hold", label: "On Hold" },
    { key: "season", label: season ? season.aisle : "Seasonal" },
    { key: "new", label: "New Releases" },
    { key: "staff", label: "Staff Picks" },
    { key: "lib", label: "Your Shelf" },
    { key: "blind", label: "Blind Date" },
    { key: "tv", label: "Television" },
    { key: "Action", label: "Action" },
    { key: "Comedy", label: "Comedy" },
    { key: "Sci-Fi", label: "Sci-Fi" },
    { key: "Horror", label: "Horror" },
    { key: "Family", label: "Family" },
    { key: "Animation", label: "Animation" },
    { key: "Romance", label: "Romance" },
    { key: "Thriller", label: "Suspense" },
    { key: "Drama", label: "Drama" },
    { key: "classic", label: "Classics" }
  ];
  var REWIND_MIN = 1960;   // Rewind Night goes back this far, and up to two years ago
  var CINEMETA = "https://v3-cinemeta.strem.io";
  var API = "https://api.strem.io/api/";
  var LINK = "https://link.stremio.com/api/v2/";
  var GENRE_KEYS = ["Action", "Comedy", "Sci-Fi", "Horror", "Family", "Romance", "Thriller", "Drama"];
  var extraAisles = [];      // catalogs from the person's installed addons
  var pager = {};            // aisle key -> { base, extras, type, skip, done, loading }
  var MAX_PER_AISLE = 600;
  var APP_VERSION = "0.22.1", APP_UPDATED = "22 Nov 2026";
  /* @@SHARED_VENUE_BRIDGE@@ */
  var staffConnected = false;
  function staffOn() { return staffConnected || !!(account && prefs.staffSeen); }
  var account = store("fnv-auth", null, function (a) { return typeof a.authKey === "string" && a.authKey ? a : null; });   // { authKey }
  var accountInfo = "";

  // ---------- state ----------
  var items = [], byId = {}, live = false;
  var aisle = "new", rewindY = 0, rewinding = false;
  var focus = { r: 1, c: 0 };
  var rows = [], rowKinds = [];
  var modal = null, lastStoreFocus = null;
  var lastGenre = "Comedy";
  var watched = store("fnv-watched", [], function (a) { return strList(a, 5000); });
  var prefs = store("fnv-prefs", { sound: false, trailers: true }, fixPrefs);
  if (!prefs.storeName) prefs.storeName = "Friday Night Video";
  if (!prefs.memberSince) { prefs.memberSince = new Date().toISOString().slice(0, 7); }
  // the corner TV playing YouTube trailers is the heaviest thing in the store on a TV; it starts on stills there
  // (once, so turning trailers back on at the front desk sticks)
  if (window.tizen && !prefs.stillsOnTV) { prefs.stillsOnTV = true; prefs.trailers = false; }
  // Calm mode: no flashing, flicker, particles, static or moving set dressing. The TV's browser can't see the system's
  // reduce-motion setting, so it's a switch at the front desk too (and starts on wherever that setting is on).
  // Atmosphere: full, calm (no flashing, flicker, particles or static; animations finish at once) or light
  // (calm, plus the corner TV shows title cards only and no trailers play: the fastest the store gets).
  if (["full", "calm", "light"].indexOf(prefs.atmos) === -1) prefs.atmos = prefs.calm === true || !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ? "calm" : "full";
  delete prefs.calm;
  applyAtmos();
  save("fnv-prefs", prefs);
  var metaCache = {};
  var libRaw = {};            // raw Stremio library items, for saving progress back
  var installedAddons = [];   // the person's Stremio addons
  var progressMap = store("fnv-progress", {}, fixProgress);
  if (!prefs.pick) prefs.pick = "4k-sdr";
  if (prefs.server === undefined) prefs.server = "";

  // Saved values are checked on the way in: anything unreadable, null or the wrong shape falls back to the default,
  // so a corrupted setting can never stop the store from opening.
