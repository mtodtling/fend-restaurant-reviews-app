let restaurants,
  neighborhoods,
  cuisines
var newMap
var markers = []

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  initMap(); // added 
  fetchNeighborhoods();
  fetchCuisines();
  registerServiceWorker();
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');
  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Initialize leaflet map, called from HTML.
 */
initMap = () => {
  self.newMap = L.map('map', {
        center: [40.722216, -73.987501],
        zoom: 12,
        scrollWheelZoom: false
      });
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
    mapboxToken: 'pk.eyJ1IjoibXRvZHRsaW5nIiwiYSI6ImNqcjkzbWpiYzBjeGQ0NHBudXFlc2hiNHEifQ.6gmYYsxmVzMc5Y86ODt-yw',
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/" tabindex="-1">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/" tabindex="-1">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/" tabindex="-1">Mapbox</a>',
    id: 'mapbox.streets'
  }).addTo(newMap);
  updateRestaurants();
}

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  if (self.markers) {
    self.markers.forEach(marker => marker.remove());
  }
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');

  const image = document.createElement('img');
  image.className = 'restaurant-img';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = restaurant.description;
  image.setAttribute('aria-label', restaurant.description);
  li.append(image);

  const name = document.createElement('h1');
  name.innerHTML = restaurant.name;
  name.setAttribute('aria-label', 'Restaurant name');
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  neighborhood.setAttribute('aria-label', 'Neighborhood');
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  address.setAttribute('aria-label', 'Adress');
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  more.tabIndex = "0";
  more.setAttribute('aria-label', restaurant.name + ' details');
  li.append(more);

  return li;
}

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.newMap);
    marker.on("click", onClick);
    function onClick() {
      window.location.href = marker.options.url;
    }
    self.markers.push(marker);
    marker.on("keypress", onKeydown); //Go to link on Enter press
    function onKeydown(e) {
      if (e.originalEvent.keyCode == 13) {
        window.location.href = marker.options.url;
      }
    }
  });

}

/**
 * Register service worker.
 */
registerServiceWorker = () => {
  if('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => { 
        console.log("Service Worker Registered");
        if (!navigator.serviceWorker.controller) {
          return;
        }
        
        if (reg.waiting) {
          updateReady(reg.waiting);
          return;
        }

        if (reg.installing) {
          trackInstalling(reg.installing);
          return;
        }

        reg.addEventListener('updatefound', () => {
          trackInstalling(reg.installing);
        });
      })
      .catch(error => { console.log("Service Worker Registration Failed" + error); });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

trackInstalling = worker => {
  worker.addEventListener('statechange', () => {
    if (worker.state == 'installed') {
      this.updateReady(worker);
    }
  });
};

updateReady = worker => {
  let refreshPage = this.confirm("New version is available. Click OK to refresh the page.");
  if (refreshPage) {
    worker.postMessage({action: 'skipWaiting'});
  } else {
    return;
  }
};
