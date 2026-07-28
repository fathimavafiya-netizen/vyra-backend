const axios = require('axios');
const token = 'YOUR_TOKEN'; // We might not even need a token if search is public, but SearchController expects AuthenticatedRequest. Wait, is it authenticated?
axios.get('http://localhost:3000/api/search?q=Flowe')
  .then(res => console.log(JSON.stringify(res.data, null, 2)))
  .catch(err => console.error(err.message));
