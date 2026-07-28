const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'esvdcd7b',
  api_key: '599194483199258',
  api_secret: '85Vr0NPhg8ldveLWsB6X3aROg40',
});

cloudinary.api.resources({ max_results: 1, type: 'upload' }, function(error, result) {
  if (error) {
    console.error(error);
  } else {
    console.log(result.resources[0].secure_url);
  }
});
