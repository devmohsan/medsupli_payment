require ('dotenv').config()
const path = require('path');
const express = require ('express')
const cors = require('cors');
const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

app.use(cors());
app.set('view engine', 'ejs'); // or pug, hbs, etc.
app.set('views', path.join(__dirname, 'views'));

const admin = require('firebase-admin');
// const serviceAccount = require('./credential.json');
const serviceAccount = {
  type: process.env.FB_TYPE,
  project_id: process.env.FB_PROJECT_ID,
  private_key_id: process.env.FB_PRIVATE_KEY_ID,
  private_key:process.env.FB_PRIVATE_KEY,
  client_email: process.env.FB_CLIENT_EMAIL,
  client_id: process.env.FB_CLIENT_ID,
  auth_uri: process.env.FB_AUTH_URI,
  token_uri: process.env.FB_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FB_AUTH_CERT_URL,
  client_x509_cert_url: process.env.FB_CLIENT_CERT_URL,
  universe_domain: process.env.FB_UNIVERSE_DOMAIN
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const routes= require('./routes/route.js')
const stripeRoutes= require('./routes/stripe.js')
const medsupliRoutes= require('./routes/medsupli.js')
app.use('/api',routes)
app.use('/stripe',stripeRoutes)
app.use('/medsupli',medsupliRoutes)
// index.js or app.js
app.get('/success', (req, res) => {
    res.render('success'); // renders views/success.ejs
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})
