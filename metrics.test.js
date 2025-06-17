import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 100 },
    { duration: "10s", target: 200 },
    { duration: "10s", target: 0 },
  ],
  // thresholds: {
  //   http_req_duration: ["p(95)<200"], // 95% des requêtes doivent être inférieures à 200ms
  // },
};

// Fonction pour obtenir un token d'authentification
export function getAuthToken() {
  const loginResp = http.post(
    `http://localhost:3000/api/auth/login`,
    JSON.stringify({
      email: "test@test.com",
      password: "testee",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
  console.log(`Login response: ${loginResp.status}`);
  if (loginResp.status === 200) {
    return JSON.parse(loginResp.body).token;
  }
  return null;
}

// Fonction setup pour exécuter avant les tests
export function setup() {
  const token = getAuthToken();
  if (!token) {
    console.error("Failed to get auth token");
    return null;
  }
  return { token };
}

// Fonction principale pour exécuter les tests
export default function(data) {
  // Exécuter le test de performance principal
  const response = http.get(`http://localhost:3000/api/feedback`, {
    headers: {
      Authorization: `Bearer ${data.token}`,
      "Content-Type": "application/json",
    },
  });
  
  // Vérifier les résultats
  const checkResults = check(response, {
    "is status 200": (r) => r.status === 200,
    "response time OK": (r) => r.timings.duration < 200,
  });
  
  // Collecter les métriques et les envoyer à l'API
  if (__VU === 1 && __ITER === 0) { // Seulement le premier utilisateur virtuel et la première itération
    const metrics = {
      url: response.url,
      status: response.status,
      duration: response.timings.duration,
      checks: checkResults,
      timestamp: new Date().toISOString()
    };
    
    // Envoyer les métriques à notre nouvelle route API
    http.post(
      `http://localhost:3000/api/metrics`,
      JSON.stringify({ metrics }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
      }
    );
  }
  
  sleep(1);
}