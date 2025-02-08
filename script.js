document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM fully loaded - script.js starting...");

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function(registration) {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(function(error) {
        console.error('Service Worker registration failed:', error);
      });
  }

  // Global variable to store current TV episode details
  let currentTvEpisodeData = {
    tvId: null,     // The TV show’s identifier
    season: null,   // Current season number
    episode: null,  // Current episode number
    tvShowName: '', // Optional: for display purposes
    tvShowPosterPath: '' // Optional: thumbnail info
  };

  // === WATCHLIST FUNCTIONS ===
  const WATCHLIST_KEY = 'userWatchlist';

  function getWatchlist() {
    const data = localStorage.getItem(WATCHLIST_KEY);
    return data ? JSON.parse(data) : [];
  }

  function saveWatchlist(items) {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
  }

  function addToWatchlist(item) {
    let items = getWatchlist();
    // Prevent duplicates by checking id and type
    if (!items.some(existing => existing.id === item.id && existing.type === item.type)) {
      items.push(item);
      saveWatchlist(items);
      alert(`${item.title} has been added to your watchlist.`);
    } else {
      alert(`${item.title} is already in your watchlist.`);
    }
  }

  // Updated to render watchlist items with poster images and dark-themed styling
  function renderWatchlist() {
    const watchlistItemsContainer = document.getElementById('watchlistItems');
    const items = getWatchlist();
    watchlistItemsContainer.innerHTML = ''; // Clear previous list

    if (items.length === 0) {
      watchlistItemsContainer.innerHTML = '<li>No items in your watchlist.</li>';
      return;
    }

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'watchlist-item';
      // Use the stored thumbnail URL if available
      li.innerHTML = `
        <img src="${item.thumbnail ? item.thumbnail : ''}" alt="${item.title}" class="watchlist-poster">
        <p>${item.title}</p>
      `;
      li.addEventListener('click', (e) => {
        e.preventDefault();
        if (item.type === 'movie') {
          playRandomMovie(item.id, item.title, item.thumbnail);
        } else {
          showTvSeasons({ id: item.id, name: item.title });
        }
        document.getElementById('watchlistModal').style.display = 'none';
      });
      watchlistItemsContainer.appendChild(li);
    });
  }

  // === WATCHLIST MODAL SETUP ===
  const watchlistButton = document.getElementById('watchlistButton');
  const watchlistModal = document.getElementById('watchlistModal');
  const closeWatchlist = document.querySelector('.close-watchlist');

  watchlistButton.addEventListener('click', () => {
    renderWatchlist();
    watchlistModal.style.display = 'block';
  });

  closeWatchlist.addEventListener('click', () => {
    watchlistModal.style.display = 'none';
  });

  // Close the modal if the user clicks outside the modal content
  window.addEventListener('click', (event) => {
    if (event.target === watchlistModal) {
      watchlistModal.style.display = 'none';
    }
  });
  // === END WATCHLIST SETUP ===

  let openServerSelection = null;

  // ========== OVERLAY CLOSE BUTTON SETUP ==========
  const closePlayerBtn = document.getElementById('closePlayerBtn');
  console.log("closePlayerBtn found:", closePlayerBtn);

  if (!closePlayerBtn) {
    console.error("No element with id='closePlayerBtn' found in the DOM! Check HTML.");
  } else {
    closePlayerBtn.onclick = () => {
      console.log("closePlayerBtn clicked - hiding overlay, clearing iframe...");
      const playerOverlay = document.getElementById('playerOverlay');
      const playerIframe = document.getElementById('playerIframe');
      const recommendedTitles = document.getElementById('recommendedTitles');
      if (playerOverlay) playerOverlay.style.display = 'none';
      if (playerIframe) playerIframe.src = '';
      if (recommendedTitles) recommendedTitles.innerHTML = '';
    };
  }

  // ========== LOADER SETUP ==========
  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.innerText = 'WolfFlix Is Loading Please Wait...';
  loader.style.position = 'fixed';
  loader.style.top = '50%';
  loader.style.left = '50%';
  loader.style.transform = 'translate(-50%, -50%)';
  loader.style.padding = '20px';
  loader.style.backgroundColor = 'rgba(0,0,0,0.8)';
  loader.style.color = 'white';
  loader.style.borderRadius = '8px';
  loader.style.display = 'none';
  loader.style.zIndex = '15000';
  document.body.appendChild(loader);

  const showLoader = () => { loader.style.display = 'block'; };
  const hideLoader = () => { loader.style.display = 'none'; };

  // ========== MAIN CONTENT CONTAINER ==========
  const moviesContainer = document.getElementById('movies');

  // ========== RECENTLY VIEWED FUNCTIONALITY ==========
  const RECENTLY_VIEWED_KEY = 'recentlyViewedItems';
  const MAX_RECENT_ITEMS = 50;

  function getRecentlyViewed() {
    const data = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return data ? JSON.parse(data) : [];
  }

  function saveRecentlyViewed(items) {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
  }

  function addRecentlyViewed(item) {
    let items = getRecentlyViewed();
    // Remove any existing entry for the same TV show
    items = items.filter(existingItem => !(existingItem.id === item.id && existingItem.type === item.type));
    items.unshift(item);
    if (items.length > MAX_RECENT_ITEMS) {
      items.pop();
    }
    saveRecentlyViewed(items);
    renderRecentlyViewed();
  }

  const chatbox = document.getElementById('chatbox');
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');

  function appendMessage(message, isBot = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (isBot) {
      messageDiv.classList.add('bot-message');
    }
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    const timestamp = new Date().toLocaleTimeString();
    timestampSpan.textContent = `[${timestamp}] `;
    const senderSpan = document.createElement('strong');
    senderSpan.textContent = isBot ? 'WolfFlix: ' : 'You: ';
    const textSpan = document.createElement('span');
    textSpan.innerHTML = message;
    messageDiv.appendChild(timestampSpan);
    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(textSpan);
    chatbox.appendChild(messageDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  const apiKey = 'b221abd73f92eec24dfe49c96877b615';

  const genresList = {
    "action": 28,
    "adventure": 12,
    "animation": 16,
    "comedy": 35,
    "crime": 80,
    "documentary": 99,
    "drama": 18,
    "family": 10751,
    "fantasy": 14,
    "history": 36,
    "horror": 27,
    "music": 10402,
    "mystery": 9648,
    "romance": 10749,
    "science fiction": 878,
    "thriller": 53,
    "war": 10752,
    "western": 37,
    "tv movie": 10770
  };

  async function fetchRecommendations(genres, type = 'movie') {
    try {
      showLoader();
      let endpoint = '';
      const genresParam = genres.join(',');
      if (type === 'movie') {
        endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genresParam}&sort_by=popularity.desc&language=en-US&page=1`;
      } else if (type === 'tv') {
        endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=${genresParam}&sort_by=popularity.desc&language=en-US&page=1`;
      } else {
        return [];
      }
      const response = await fetch(endpoint);
      const data = await response.json();
      return data.results.slice(0, 5);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      return [];
    } finally {
      hideLoader();
    }
  }

  async function searchActor(actorName) {
    try {
      showLoader();
      const endpoint = `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(actorName)}`;
      const response = await fetch(endpoint);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].id;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error searching for actor:", error);
      return null;
    } finally {
      hideLoader();
    }
  }

  async function fetchActorCredits(actorId) {
    try {
      showLoader();
      const movieCreditsEndpoint = `https://api.themoviedb.org/3/person/${actorId}/movie_credits?api_key=${apiKey}&language=en-US`;
      const tvCreditsEndpoint = `https://api.themoviedb.org/3/person/${actorId}/tv_credits?api_key=${apiKey}&language=en-US`;
      const [movieResponse, tvResponse] = await Promise.all([
        fetch(movieCreditsEndpoint),
        fetch(tvCreditsEndpoint)
      ]);
      const movieData = await movieResponse.json();
      const tvData = await tvResponse.json();
      const movies = movieData.cast ? movieData.cast.slice(0, 5) : [];
      const tvShows = tvData.cast ? tvData.cast.slice(0, 5) : [];
      return { movies, tvShows };
    } catch (error) {
      console.error("Error fetching actor credits:", error);
      return { movies: [], tvShows: [] };
    } finally {
      hideLoader();
    }
  }

  async function fetchCombinedRecommendations(genres, actorId) {
    try {
      showLoader();
      let movieRecommendations = [];
      let tvRecommendations = [];
      if (genres.length > 0) {
        movieRecommendations = await fetchRecommendations(genres, 'movie');
        tvRecommendations = await fetchRecommendations(genres, 'tv');
      }
      if (actorId) {
        const credits = await fetchActorCredits(actorId);
        movieRecommendations = movieRecommendations.concat(credits.movies);
        tvRecommendations = tvRecommendations.concat(credits.tvShows);
      }
      const uniqueMovies = [];
      const movieIds = new Set();
      movieRecommendations.forEach(movie => {
        if (!movieIds.has(movie.id)) {
          movieIds.add(movie.id);
          uniqueMovies.push(movie);
        }
      });
      const uniqueTvShows = [];
      const tvShowIds = new Set();
      tvRecommendations.forEach(tv => {
        if (!tvShowIds.has(tv.id)) {
          tvShowIds.add(tv.id);
          uniqueTvShows.push(tv);
        }
      });
      const finalMovies = uniqueMovies.slice(0, 10);
      const finalTvShows = uniqueTvShows.slice(0, 10);
      return { movies: finalMovies, tvShows: finalTvShows };
    } catch (error) {
      console.error("Error fetching combined recommendations:", error);
      return { movies: [], tvShows: [] };
    } finally {
      hideLoader();
    }
  }

  async function handleRecommendationRequest(message) {
    const lowerCaseMessage = message.toLowerCase();
    let genres = [];
    let actorName = null;
    let type = 'both';
    const actorPattern = /(?:with|featuring|starring)\s+([a-zA-Z\s]+)/;
    let match = lowerCaseMessage.match(actorPattern);
    if (match && match[1]) {
      actorName = match[1].trim();
      message = message.replace(match[0], '');
    }
    for (const genre in genresList) {
      if (lowerCaseMessage.includes(genre)) {
        genres.push(genre);
      }
    }
    if (lowerCaseMessage.includes('movie') && !lowerCaseMessage.includes('tv')) {
      type = 'movie';
    } else if (lowerCaseMessage.includes('tv') && !lowerCaseMessage.includes('movie')) {
      type = 'tv';
    }
    const genreIds = genres.map((genre) => genresList[genre.toLowerCase()]).filter((id) => id);
    const unrecognizedGenres = genres.filter((genre, index) => !genreIds[index]);
    if (unrecognizedGenres.length > 0) {
      appendMessage(
        `Sorry, I couldn't recognize the genre(s): "${unrecognizedGenres.join(', ')}". Please try another one.`,
        true
      );
      return;
    }
    let actorId = null;
    if (actorName) {
      actorId = await searchActor(actorName);
      if (!actorId) {
        appendMessage(
          `Sorry, I couldn't find an actor named "${actorName}". Please check the name and try again.`,
          true
        );
        return;
      }
    }
    const { movies, tvShows } = await fetchCombinedRecommendations(genreIds, actorId);
    let recommendationText = '';
    if (movies.length > 0) {
      recommendationText += `**Movies:**<ul>`;
      movies.forEach((rec) => {
        const title = rec.title || rec.name;
        const releaseDate = rec.release_date || rec.first_air_date || 'N/A';
        recommendationText += `<li>${title} (${releaseDate.substring(0, 4)})</li>`;
      });
      recommendationText += `</ul>`;
    }
    if (tvShows.length > 0) {
      recommendationText += `**TV Shows:**<ul>`;
      tvShows.forEach((rec) => {
        const title = rec.title || rec.name;
        const releaseDate = rec.release_date || rec.first_air_date || 'N/A';
        recommendationText += `<li>${title} (${releaseDate.substring(0, 4)})</li>`;
      });
      recommendationText += `</ul>`;
    }
    if (recommendationText) {
      appendMessage(recommendationText, true);
      movies.forEach((rec) => {
        const recentlyViewedItem = {
          id: rec.id,
          title: rec.title || rec.name,
          type: 'movie',
          thumbnail: rec.poster_path
            ? `https://image.tmdb.org/t/p/w200${rec.poster_path}`
            : ''
        };
        addRecentlyViewed(recentlyViewedItem);
      });
      tvShows.forEach((rec) => {
        const recentlyViewedItem = {
          id: rec.id,
          title: rec.title || rec.name,
          type: 'tv_show',
          thumbnail: rec.poster_path
            ? `https://image.tmdb.org/t/p/w200${rec.poster_path}`
            : ''
        };
        addRecentlyViewed(recentlyViewedItem);
      });
      appendMessage(
        `I've added these titles to your Recently Viewed category for you to look at later.`,
        true
      );
    } else {
      appendMessage(
        `Sorry, I couldn't find any recommendations based on your request.`,
        true
      );
    }
  }

  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (msg === '') return;
    appendMessage(msg, false);
    messageInput.value = '';
    await handleRecommendationRequest(msg);
  });

  // ========== CATEGORIES ==========
  const categories = [
    { name: 'Recently Viewed', recentlyViewed: true },
    { name: 'Trending Movies', endpoint: `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}` },
    { name: 'Trending TV Shows', endpoint: `https://api.themoviedb.org/3/trending/tv/week?api_key=${apiKey}` },
    { name: 'Popular Movies', endpoint: `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=1` },
    { name: 'Popular TV Shows', endpoint: `https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=en-US&page=1` },
    { name: 'Top Rated Movies', endpoint: `https://api.themoviedb.org/3/movie/top_rated?api_key=${apiKey}&language=en-US&page=1` },
    { name: 'Top Rated TV Shows', endpoint: `https://api.themoviedb.org/3/tv/top_rated?api_key=${apiKey}&language=en-US&page=1` },
    { name: 'Action Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=28` },
    { name: 'Action TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=10759` },
    { name: 'Adventure Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=12` },
    { name: 'Adventure TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=10759` },
    { name: 'Animation Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=16` },
    { name: 'Animation TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16` },
    { name: 'Comedy Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=35` },
    { name: 'Comedy TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=35` },
    { name: 'Crime Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=80` },
    { name: 'Crime TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=80` },
    { name: 'Documentary Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=99` },
    { name: 'Documentary TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=99` },
    { name: 'Drama Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=18` },
    { name: 'Drama TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=18` },
    { name: 'Family Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=10751` },
    { name: 'Family TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=10751` },
    { name: 'Fantasy Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=14` },
    { name: 'Fantasy TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=10765` },
    { name: 'History Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=36` },
    { name: 'History TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=36` },
    { name: 'Horror Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=27` },
    { name: 'Music Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=10402` },
    { name: 'Mystery Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=9648` },
    { name: 'Mystery TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=9648` },
    { name: 'Romance Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=10749` },
    { name: 'Romance TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=10749` },
    { name: 'Science Fiction Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=878` },
    { name: 'Science Fiction TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=10765` },
    { name: 'Thriller Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=53` },
    { name: 'War Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=10752` },
    { name: 'Western Movies', endpoint: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=37` },
    { name: 'Western TV Shows', endpoint: `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=37` },
    { name: 'Live TV', endpoint: 'https://streamed.su/api/matches/all-today', liveTV: true, id: 'live-tv-section' }
  ];

  async function fetchAndDisplayCategories() {
    console.log("fetchAndDisplayCategories started");

    for (const category of categories) {
      if (category.recentlyViewed) {
        createRecentlyViewedCategory();
        continue;
      }

      console.log("Loading category:", category.name);

      const section = document.createElement('section');
      section.className = 'category';
      section.innerHTML = `
        <h2>${category.name}</h2>
        <div class="scroll-container">
          <button class="scroll-btn left-btn">◀</button>
          <div class="movies"></div>
          <button class="scroll-btn right-btn">▶</button>
        </div>
      `;

      const categoryContainer = section.querySelector('.movies');
      moviesContainer.appendChild(section);

      if (category.liveTV) {
        section.style.display = 'none';
        section.id = category.id;
      }

      try {
        showLoader();
        const response = await fetch(category.endpoint);
        const data = await response.json();
        console.log(`Category "${category.name}" fetch result:`, data);

        if (category.liveTV && Array.isArray(data)) {
          data.forEach((match) => {
            const liveTvTitle = document.createElement('div');
            liveTvTitle.className = 'live-tv-title';
            liveTvTitle.innerHTML = `
              <h3>${match.title || match.id || 'No Title'}</h3>
            `;
            const playButton = document.createElement('button');
            playButton.innerText = 'Play';
            playButton.style.backgroundColor = '#4CAF50';
            playButton.style.color = 'white';
            playButton.style.border = 'none';
            playButton.style.padding = '5px 10px';
            playButton.style.cursor = 'pointer';
            playButton.style.borderRadius = '4px';
            playButton.style.marginTop = '5px';

            playButton.onclick = () => {
              if (openServerSelection) {
                openServerSelection.remove();
              }

              const servers = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
              const serverSelection = document.createElement('div');
              serverSelection.className = 'server-selection';
              serverSelection.style.position = 'absolute';
              serverSelection.style.top = `${liveTvTitle.getBoundingClientRect().bottom + window.scrollY}px`;
              serverSelection.style.left = `${liveTvTitle.getBoundingClientRect().left}px`;
              serverSelection.style.backgroundColor = '#333';
              serverSelection.style.padding = '10px';
              serverSelection.style.borderRadius = '8px';
              serverSelection.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              serverSelection.style.zIndex = '10001';

              servers.forEach((server) => {
                const serverButton = document.createElement('button');
                serverButton.innerText = server;
                serverButton.style.margin = '5px';
                serverButton.style.backgroundColor = '#8e44ad';
                serverButton.style.color = 'white';
                serverButton.style.border = 'none';
                serverButton.style.padding = '5px 10px';
                serverButton.style.cursor = 'pointer';
                serverButton.style.borderRadius = '4px';
                serverButton.style.transition = 'background-color 0.3s';

                serverButton.onmouseenter = () => {
                  serverButton.style.backgroundColor = '#a569bd';
                };
                serverButton.onmouseleave = () => {
                  serverButton.style.backgroundColor = '#8e44ad';
                };

                serverButton.onclick = () => {
                  const streamUrl = `https://streamed.su/watch/${match.id}/${server.toLowerCase()}/1`;
                  window.open(streamUrl, '_blank');
                  serverSelection.remove();
                  openServerSelection = null;
                };
                serverSelection.appendChild(serverButton);
              });

              document.body.appendChild(serverSelection);
              openServerSelection = serverSelection;
            };

            liveTvTitle.appendChild(playButton);
            categoryContainer.appendChild(liveTvTitle);
          });
        } else {
          if (data.results && data.results.length > 0) {
            data.results.forEach(item => {
              const isMovie = !!item.title;
              const movieCard = createMovieCard(item, isMovie);
              categoryContainer.appendChild(movieCard);
            });
          }
        }
      } catch (err) {
        console.error("Error loading category:", category.name, err);
      } finally {
        hideLoader();
      }

      const leftBtn = section.querySelector('.left-btn');
      const rightBtn = section.querySelector('.right-btn');
      leftBtn.onclick = () => {
        categoryContainer.scrollBy({ left: -300, behavior: 'smooth' });
      };
      rightBtn.onclick = () => {
        categoryContainer.scrollBy({ left: 300, behavior: 'smooth' });
      };
    }
  }

  function createRecentlyViewedCategory() {
    console.log("Creating Recently Viewed category");

    const section = document.createElement('section');
    section.className = 'category recently-viewed-section';
    section.innerHTML = `
      <h2>Recently Viewed</h2>
      <div class="scroll-container">
        <button class="scroll-btn left-btn">◀</button>
        <div class="movies" id="recently-viewed-items"></div>
        <button class="scroll-btn right-btn">▶</button>
      </div>
    `;

    moviesContainer.appendChild(section);

    const leftButton = section.querySelector('.left-btn');
    const rightButton = section.querySelector('.right-btn');
    const recentItemsContainer = section.querySelector('.movies');

    leftButton.onclick = () => {
      recentItemsContainer.scrollBy({ left: -300, behavior: 'smooth' });
    };
    rightButton.onclick = () => {
      recentItemsContainer.scrollBy({ left: 300, behavior: 'smooth' });
    };

    renderRecentlyViewed();
  }

  function renderRecentlyViewed() {
    const container = document.getElementById('recently-viewed-items');
    if (!container) return;
    const items = getRecentlyViewed();
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = '<p>No recently viewed items.</p>';
      return;
    }
    items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.classList.add('movie');
      if (item.thumbnail) {
        const img = document.createElement('img');
        img.src = item.thumbnail;
        img.alt = item.title || 'Untitled';
        itemElement.appendChild(img);
      }
      const title = document.createElement('p');
      title.textContent = `${item.title} (${item.type === 'movie' ? 'Movie' : 'TV Show'})`;
      itemElement.appendChild(title);
      itemElement.onclick = async () => {
        if (item.type === 'movie') {
          await playRandomMovie(item.id, item.title, item.thumbnail, item.progress);
        } else {
          await showTvSeasons({ id: item.id, name: item.title }, null, item.progress);
        }
      };
      container.appendChild(itemElement);
    });
  }

  function createMovieCard(item, isMovie) {
    const movieElement = document.createElement('div');
    movieElement.className = 'movie';
    if (item.poster_path) {
      const img = document.createElement('img');
      img.src = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
      img.alt = item.title || item.name;
      movieElement.appendChild(img);
    } else {
      const imgPlaceholder = document.createElement('img');
      imgPlaceholder.style.display = 'none';
      movieElement.appendChild(imgPlaceholder);
    }
    const title = document.createElement('p');
    title.textContent = item.title || item.name || 'Untitled';
    movieElement.appendChild(title);

    // Add "Add to Watchlist" button
    const watchlistBtn = document.createElement('button');
    watchlistBtn.innerText = 'Add to Watchlist';
    watchlistBtn.classList.add('watchlist-btn');
    watchlistBtn.onclick = (event) => {
      event.stopPropagation();
      addToWatchlist({
        id: item.id,
        title: item.title || item.name || 'Untitled',
        type: isMovie ? 'movie' : 'tv_show',
        thumbnail: item.poster_path
          ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
          : ''
      });
    };
    movieElement.appendChild(watchlistBtn);

    movieElement.onclick = async (event) => {
      console.log("MovieCard clicked. isMovie:", isMovie, " item:", item);
      if (isMovie) {
        await playRandomMovie(item.id, item.title, item.poster_path);
      } else {
        const rect = event.target.getBoundingClientRect();
        await showTvSeasons(item, rect);
      }
      const recentlyViewedItem = {
        id: item.id,
        title: item.title || item.name || 'Untitled',
        type: isMovie ? 'movie' : 'tv_show',
        thumbnail: item.poster_path
          ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
          : ''
      };
      addRecentlyViewed(recentlyViewedItem);
    };

    return movieElement;
  }

  // --- UPDATED: Using new API endpoints ---

  // For movies: use https://vidsrc.su/embed/movie/{tmdb_id}
  function playRandomMovie(movieId, title, posterPath, progress = 0) {
    console.log("playRandomMovie called with:", movieId, "progress:", progress);
    const embedUrl = `https://vidsrc.su/embed/movie/${movieId}`;
    const urlWithProgress = progress > 0 ? `${embedUrl}?start=${progress}` : embedUrl;
    openPlayer(urlWithProgress, { id: movieId, type: 'movie' });
  }

  // For TV shows: use https://vidsrc.su/embed/tv/{tmdb_id}/{season_number}/{episode_number}
  async function playEpisode(tvId, seasonNumber, episodeNumber, tvShowName, tvShowPosterPath, progress = 0) {
    // Update the global variable with the current episode details.
    currentTvEpisodeData = { 
      tvId, 
      season: seasonNumber, 
      episode: episodeNumber, 
      tvShowName, 
      tvShowPosterPath 
    };

    const embedUrl = `https://vidsrc.su/embed/tv/${tvId}/${seasonNumber}/${episodeNumber}`;
    const urlWithProgress = progress > 0 ? `${embedUrl}?start=${progress}` : embedUrl;

    openPlayer(urlWithProgress, { id: tvId, type: 'tv_show' });
    
    // Optionally, add the episode to your recently viewed list.
    const recentlyViewedItem = {
      id: tvId,
      title: `${tvShowName} (Season ${seasonNumber}) (Episode ${episodeNumber})`,
      type: 'tv_show',
      season: seasonNumber,
      episode: episodeNumber,
      thumbnail: tvShowPosterPath ? `https://image.tmdb.org/t/p/w200${tvShowPosterPath}` : '',
      progress: progress
    };
    addRecentlyViewed(recentlyViewedItem);
  }

  function openPlayer(embedUrl, currentContent = null) {
    const playerOverlay = document.getElementById('playerOverlay');
    const playerIframe = document.getElementById('playerIframe');
    const recommendedTitles = document.getElementById('recommendedTitles');
    if (playerOverlay && playerIframe) {
      playerIframe.src = embedUrl;
      playerOverlay.style.display = 'flex';
      createRecommendedTitlesSection();
      if (currentContent && currentContent.id && currentContent.type) {
        fetchAndDisplayRecommendations(currentContent.id, currentContent.type);
      }
    }
  }

  function createRecommendedTitlesSection() {
    const playerOverlay = document.getElementById('playerOverlay');
    if (!playerOverlay) {
      console.error("No element with id='playerOverlay' found in the DOM!");
      return;
    }
    if (document.querySelector('.recommended-titles')) {
      return;
    }
    const recommendedSection = document.createElement('section');
    recommendedSection.className = 'recommended-titles';
    recommendedSection.innerHTML = `
      <h2>Recommended Titles</h2>
      <div class="scroll-container">
        <button class="scroll-btn left-btn">◀</button>
        <div class="movies recommended-movies"></div>
        <button class="scroll-btn right-btn">▶</button>
      </div>
    `;
    playerOverlay.appendChild(recommendedSection);
    const leftBtn = recommendedSection.querySelector('.scroll-container .left-btn');
    const rightBtn = recommendedSection.querySelector('.scroll-container .right-btn');
    const recommendedMoviesContainer = recommendedSection.querySelector('.recommended-movies');
    leftBtn.onclick = () => {
      recommendedMoviesContainer.scrollBy({ left: -300, behavior: 'smooth' });
    };
    rightBtn.onclick = () => {
      recommendedMoviesContainer.scrollBy({ left: 300, behavior: 'smooth' });
    };
  }

  async function fetchAndDisplayRecommendations(contentId, contentType) {
    console.log("Fetching recommendations for:", contentId, contentType);
    const recommendedContainer = document.querySelector('.recommended-movies');
    if (!recommendedContainer) {
      console.error("No element with class='recommended-movies' found in the DOM!");
      return;
    }
    recommendedContainer.innerHTML = '';
    try {
      showLoader();
      let endpoint = '';
      if (contentType === 'movie') {
        endpoint = `https://api.themoviedb.org/3/movie/${contentId}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
      } else if (contentType === 'tv_show') {
        endpoint = `https://api.themoviedb.org/3/tv/${contentId}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
      } else {
        console.error("Unknown content type for recommendations:", contentType);
        return;
      }
      const response = await fetch(endpoint);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const recommendations = data.results.slice(0, 10);
        recommendations.forEach(rec => {
          const recType = rec.title ? 'movie' : 'tv_show';
          const recId = rec.id;
          const recTitle = rec.title || rec.name || 'Untitled';
          const recPoster = rec.poster_path ? `https://image.tmdb.org/t/p/w200${rec.poster_path}` : '';
          const recCard = document.createElement('div');
          recCard.className = 'recommended-title-card';
          if (rec.poster_path) {
            const img = document.createElement('img');
            img.src = recPoster;
            img.alt = recTitle;
            recCard.appendChild(img);
          }
          const recTitleElem = document.createElement('p');
          recTitleElem.textContent = recTitle;
          recCard.appendChild(recTitleElem);
          recCard.onclick = () => {
            if (recType === 'movie') {
              playRandomMovie(recId, recTitle, rec.poster_path);
            } else {
              showTvSeasons({ id: recId, name: recTitle }, null);
            }
            const recentlyViewedItem = {
              id: recId,
              title: recTitle,
              type: recType,
              thumbnail: rec.poster_path
                ? `https://image.tmdb.org/t/p/w200${rec.poster_path}`
                : ''
            };
            addRecentlyViewed(recentlyViewedItem);
          };
          recommendedContainer.appendChild(recCard);
        });
      } else {
        recommendedContainer.innerHTML = '<p>No recommendations available.</p>';
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      recommendedContainer.innerHTML = '<p>Error fetching recommendations.</p>';
    } finally {
      hideLoader();
    }
  }

  async function showTvSeasons(tvItem, rect, progress = 0) {
    try {
      const resp = await fetch(`https://api.themoviedb.org/3/tv/${tvItem.id}?api_key=${apiKey}`);
      const tvData = await resp.json();
      const seasons = tvData.seasons || [];
      const tvShowName = tvData.name || 'Untitled';
      const tvShowPosterPath = tvData.poster_path || '';
      const seasonWindow = document.createElement('div');
      seasonWindow.className = 'season-window';
      seasonWindow.setAttribute('role', 'dialog');
      seasonWindow.setAttribute('aria-modal', 'true');
      seasonWindow.setAttribute('aria-labelledby', 'seasonWindowTitle');
      seasonWindow.style.position = 'fixed';
      seasonWindow.style.top = '50%';
      seasonWindow.style.left = '50%';
      seasonWindow.style.transform = 'translate(-50%, -50%)';
      seasonWindow.style.width = '80%';
      seasonWindow.style.maxHeight = '80vh';
      seasonWindow.style.overflowY = 'auto';
      seasonWindow.style.backgroundColor = '#2e2e2e';
      seasonWindow.style.color = '#fff';
      seasonWindow.style.padding = '20px';
      seasonWindow.style.borderRadius = '8px';
      seasonWindow.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
      seasonWindow.style.zIndex = '10000';
      seasonWindow.innerHTML = `
        <h3 id="seasonWindowTitle">${tvShowName}</h3>
        <button id="closeSeasonWindow" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">Close</button>
        <div id="seasonButtons" style="margin-top: 10px;"></div>
        <div id="episodesDiv" style="margin-top: 20px;"></div>
      `;
      document.body.appendChild(seasonWindow);
      const closeBtn = seasonWindow.querySelector('#closeSeasonWindow');
      closeBtn.onclick = () => seasonWindow.remove();
      const handleEscape = (event) => {
        if (event.key === 'Escape') {
          seasonWindow.remove();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
      const episodesDiv = seasonWindow.querySelector('#episodesDiv');
      seasons.forEach((s) => {
        const btn = document.createElement('button');
        btn.textContent = s.name;
        btn.style.margin = '4px';
        btn.style.backgroundColor = '#8e44ad';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.padding = '5px 10px';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        btn.style.transition = 'background-color 0.3s';
        btn.onmouseenter = () => {
          btn.style.backgroundColor = '#a569bd';
        };
        btn.onmouseleave = () => {
          btn.style.backgroundColor = '#8e44ad';
        };
        btn.onclick = async () => {
          episodesDiv.innerHTML = '';
          await showEpisodes(tvItem, s.season_number, episodesDiv, tvShowName, tvShowPosterPath);
        };
        seasonWindow.querySelector('#seasonButtons').appendChild(btn);
      });
    } catch (err) {
      console.error("Error fetching TV seasons:", err);
    }
  }

  async function showEpisodes(tvShow, seasonNumber, container, tvShowName, tvShowPosterPath) {
    console.log("showEpisodes called:", tvShow.id, seasonNumber);
    try {
      const resp = await fetch(
        `https://api.themoviedb.org/3/tv/${tvShow.id}/season/${seasonNumber}?api_key=${apiKey}`
      );
      const seasonData = await resp.json();
      seasonData.episodes.forEach((ep) => {
        const episodeElement = document.createElement('div');
        episodeElement.innerHTML = `
          <strong>${ep.episode_number}. ${ep.name}</strong><br>
          <small><strong>Air Date:</strong> ${ep.air_date}</small><br>
          <p><strong>Overview:</strong> ${ep.overview}</p>
        `;
        episodeElement.style.marginBottom = '10px';
        episodeElement.style.cursor = 'pointer';
        episodeElement.style.transition = 'background-color 0.3s';
        episodeElement.style.padding = '10px';
        episodeElement.style.borderRadius = '4px';
        episodeElement.style.backgroundColor = '#2e2e2e';
        episodeElement.onmouseenter = () => {
          episodeElement.style.backgroundColor = '#800080';
        };
        episodeElement.onmouseleave = () => {
          episodeElement.style.backgroundColor = '#2e2e2e';
        };

        // Update the onclick handler to play the episode and close the selector
        episodeElement.onclick = () => {
          playEpisode(tvShow.id, seasonNumber, ep.episode_number, tvShowName, tvShowPosterPath);
          // Close the episode selector window
          const seasonWindow = document.querySelector('.season-window');
          if (seasonWindow) {
            seasonWindow.remove();
          }
        };

        container.appendChild(episodeElement);
      });
    } catch (err) {
      console.error("Error fetching episodes:", err);
    }
  }

  // --- Next Episode Button ---
  document.getElementById('nextEpisodeBtn').addEventListener('click', () => {
    if (!currentTvEpisodeData.tvId) {
      alert('No TV episode is currently playing.');
      return;
    }
    
    // Calculate the next episode number.
    const newEpisode = currentTvEpisodeData.episode + 1;
    currentTvEpisodeData.episode = newEpisode;
    
    // Updated embed URL for the next episode:
    const embedUrl = `https://vidsrc.su/embed/tv/${currentTvEpisodeData.tvId}/${currentTvEpisodeData.season}/${newEpisode}`;
    openPlayer(embedUrl, { id: currentTvEpisodeData.tvId, type: 'tv_show' });
    
    // Update Recently Viewed with the new episode details.
    const recentlyViewedItem = {
      id: currentTvEpisodeData.tvId,
      title: `${currentTvEpisodeData.tvShowName} (Season ${currentTvEpisodeData.season}) (Episode ${newEpisode})`,
      type: 'tv_show',
      season: currentTvEpisodeData.season,
      episode: newEpisode,
      thumbnail: currentTvEpisodeData.tvShowPosterPath ? `https://image.tmdb.org/t/p/w200${currentTvEpisodeData.tvShowPosterPath}` : '',
      progress: 0
    };
    addRecentlyViewed(recentlyViewedItem);
  });

  // --- Previous Episode Button ---
  document.getElementById('prevEpisodeBtn').addEventListener('click', () => {
    if (!currentTvEpisodeData.tvId) {
      alert('No TV episode is currently playing.');
      return;
    }
    
    if (currentTvEpisodeData.episode <= 1) {
      alert('This is the first episode.');
      return;
    }
    
    const newEpisode = currentTvEpisodeData.episode - 1;
    currentTvEpisodeData.episode = newEpisode;
    
    // Updated embed URL for the previous episode:
    const embedUrl = `https://vidsrc.su/embed/tv/${currentTvEpisodeData.tvId}/${currentTvEpisodeData.season}/${newEpisode}`;
    openPlayer(embedUrl, { id: currentTvEpisodeData.tvId, type: 'tv_show' });
    
    // Update Recently Viewed with the new episode details.
    const recentlyViewedItem = {
      id: currentTvEpisodeData.tvId,
      title: `${currentTvEpisodeData.tvShowName} (Season ${currentTvEpisodeData.season}) (Episode ${newEpisode})`,
      type: 'tv_show',
      season: currentTvEpisodeData.season,
      episode: newEpisode,
      thumbnail: currentTvEpisodeData.tvShowPosterPath ? `https://image.tmdb.org/t/p/w200${currentTvEpisodeData.tvShowPosterPath}` : '',
      progress: 0
    };
    addRecentlyViewed(recentlyViewedItem);
  });

  function createSearchResultCard(item, isMovie) {
    const container = document.createElement('div');
    container.style.display = 'inline-block';
    container.style.width = '100px'; 
    container.style.marginRight = '10px';
    container.style.textAlign = 'center';
    container.style.cursor = 'pointer';
    container.style.backgroundColor = '#2e2e2e';
    container.style.borderRadius = '6px';
    container.style.padding = '5px';
    container.style.transition = 'transform 0.2s';
    container.style.boxSizing = 'border-box';
    container.onmouseenter = () => {
      container.style.transform = 'scale(1.05)';
    };
    container.onmouseleave = () => {
      container.style.transform = 'scale(1)';
    };
    if (item.poster_path) {
      const img = document.createElement('img');
      img.style.width = '100%';
      img.style.borderRadius = '6px';
      img.src = `https://image.tmdb.org/t/p/w200${item.poster_path}`;
      img.alt = item.title || item.name || 'Untitled';
      container.appendChild(img);
    } else {
      const imgPlaceholder = document.createElement('img');
      imgPlaceholder.style.display = 'none';
      container.appendChild(imgPlaceholder);
    }
    const title = document.createElement('div');
    title.style.fontSize = '0.8rem';
    title.style.marginTop = '5px';
    title.style.color = '#fff';
    title.textContent = item.title || item.name || 'Untitled';
    container.appendChild(title);
    container.onclick = async () => {
      if (isMovie) {
        await playRandomMovie(item.id, item.title, item.poster_path);
      } else {
        await showTvSeasons({ id: item.id, name: item.name }, null);
      }
      const recentlyViewedItem = {
        id: item.id,
        title: item.title || item.name || 'Untitled',
        type: isMovie ? 'movie' : 'tv_show',
        thumbnail: item.poster_path
          ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
          : ''
      };
      addRecentlyViewed(recentlyViewedItem);
      const searchResultsContainer = document.querySelector('.search-results');
      if (searchResultsContainer) {
        searchResultsContainer.style.display = 'none';
      }
    };
    return container;
  }

  function createSearchElements() {
    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer) {
      console.warn("No .search-container found in HTML!");
      return;
    }
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search Movies or TV Shows';
    searchInput.style.padding = '8px';
    searchInput.style.width = '100%';
    searchInput.style.boxSizing = 'border-box';
    searchInput.style.borderRadius = '4px';
    searchInput.style.border = 'none';
    searchInput.style.outline = 'none';
    searchInput.style.backgroundColor = '#444';
    searchInput.style.color = 'white';
    const searchResultsContainer = document.createElement('div');
    searchResultsContainer.className = 'search-results';
    searchResultsContainer.style.display = 'none';
    searchResultsContainer.style.position = 'absolute';
    searchResultsContainer.style.zIndex = '9999';
    searchResultsContainer.style.maxHeight = '300px';
    searchResultsContainer.style.overflowY = 'auto';
    searchResultsContainer.style.backgroundColor = '#2e2e2e';
    searchResultsContainer.style.color = 'white';
    searchResultsContainer.style.border = '1px solid #444';
    searchResultsContainer.style.borderTop = 'none';
    searchResultsContainer.style.borderRadius = '0 0 8px 8px';
    searchResultsContainer.style.padding = '10px';
    searchResultsContainer.style.width = '100%';
    searchResultsContainer.style.left = '0';
    searchResultsContainer.style.transform = 'none';
    searchContainer.style.position = 'relative';
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchResultsContainer);
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    document.addEventListener('click', (e) => {
      if (!searchContainer.contains(e.target)) {
        searchResultsContainer.style.display = 'none';
      }
    });
  }

  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  async function handleSearch() {
    const searchInput = document.querySelector('.search-container input');
    const searchResultsContainer = document.querySelector('.search-results');
    const query = searchInput.value.trim();
    if (!query) {
      searchResultsContainer.innerHTML = '';
      searchResultsContainer.style.display = 'none';
      return;
    }
    try {
      showLoader();
      console.log("Searching for:", query);
      const searchEndpoint = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&api_key=${apiKey}`;
      const resp = await fetch(searchEndpoint);
      const data = await resp.json();
      searchResultsContainer.innerHTML = '';
      if (data.results && data.results.length > 0) {
        const results = data.results.slice(0, 5);
        results.forEach(item => {
          const isMovie = !!item.title;
          const card = createSearchResultCard(item, isMovie);
          searchResultsContainer.appendChild(card);
        });
        searchResultsContainer.style.display = 'block';
      } else {
        searchResultsContainer.innerHTML = '<p>No results found.</p>';
        searchResultsContainer.style.display = 'block';
      }
    } catch (error) {
      console.error("Error during search:", error);
      searchResultsContainer.innerHTML = '<p>Error fetching results.</p>';
      searchResultsContainer.style.display = 'block';
    } finally {
      hideLoader();
    }
  }

  createSearchElements();
  fetchAndDisplayCategories();

  const toggleButton = document.createElement('button');
  toggleButton.innerText = 'Toggle Live TV';
  toggleButton.style.position = 'fixed';
  toggleButton.style.bottom = '20px';
  toggleButton.style.right = '20px';
  toggleButton.style.padding = '10px 15px';
  toggleButton.style.zIndex = '10000'; 
  toggleButton.style.backgroundColor = '#6A1B9A';
  toggleButton.style.color = 'white';
  toggleButton.style.border = 'none';
  toggleButton.style.borderRadius = '5px';
  toggleButton.style.cursor = 'pointer';
  toggleButton.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  toggleButton.style.transition = 'background-color 0.3s ease';
  toggleButton.onmouseenter = () => {
    toggleButton.style.backgroundColor = '#8e44ad';
  };
  toggleButton.onmouseleave = () => {
    toggleButton.style.backgroundColor = '#6A1B9A';
  };
  toggleButton.onclick = () => {
    const liveTvSection = document.getElementById('live-tv-section');
    if (!liveTvSection) {
      alert("Live TV section not found!");
      return;
    }
    const isLiveTvVisible = liveTvSection.style.display === 'none';
    liveTvSection.style.display = isLiveTvVisible ? 'block' : 'none';
    if (isLiveTvVisible) {
      liveTvSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  document.body.appendChild(toggleButton);
  console.log("script.js finished loading.");
});
