require('dotenv').config();
const http = require('http');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYjE0MDA1Zi05MGRmLTRhZmEtOTA0MS02N2IzYjA3MmVjZjAiLCJpYXQiOjE3NzgxMzk0NDAsImV4cCI6MTc4MDczMTQ0MH0.aYP-pnDZfwYFgINktJ6CAzvDcCszndHC01ZlAtHxtqI';

function req(method, path, body) {
  return new Promise((resolve) => {
    const opts = { hostname:'localhost', port:3000, path, method, headers:{'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'} };
    const r = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try { resolve({status:res.statusCode, body:JSON.parse(d)}); } catch(e) { resolve({status:res.statusCode, body:{}}); } }); });
    r.on('error', e => resolve({status:0, body:{error:e.message}}));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  const ok = s => s >= 200 && s < 300;

  const nearby = await req('GET', '/api/restaurants/nearby?lat=41.037&lng=28.985');
  console.log((ok(nearby.status)?'✓':'✗')+' Nearby: '+nearby.body.results?.length+' restoran ('+nearby.status+')');
  const placeId = nearby.body.results?.[0]?.placeId;
  const placeName = nearby.body.results?.[0]?.name;

  const detail = await req('GET', '/api/restaurants/'+placeId+'?lat=41.037&lng=28.985');
  console.log((ok(detail.status)?'✓':'✗')+' Detail: '+detail.body.name+' ('+detail.status+')');

  const revGet = await req('GET', '/api/reviews/'+placeId);
  console.log((ok(revGet.status)?'✓':'✗')+' Reviews GET: '+revGet.body.length+' yorum ('+revGet.status+')');

  const revPost = await req('POST', '/api/reviews', {placeId, rating:5, body:'Harika bir yer, kesinlikle tavsiye ederim!'});
  console.log((ok(revPost.status)?'✓':'✗')+' Review POST: id='+revPost.body.review?.id?.slice(0,8)+', star='+revPost.body.starEvent?.amount+' ('+revPost.status+')');

  const favAdd = await req('POST', '/api/favorites', {placeId, placeName:detail.body.name, placeAddress:detail.body.formattedAddress, placeLat:41.037, placeLng:28.985, placeRating:detail.body.rating, placePhotoUrl:null, placePhone:null});
  console.log((ok(favAdd.status)?'✓':'✗')+' Favorite ADD: '+favAdd.body.id?.slice(0,8)+' ('+favAdd.status+')');

  const favList = await req('GET', '/api/favorites');
  console.log((ok(favList.status)?'✓':'✗')+' Favorites GET: '+favList.body.length+' ('+favList.status+')');

  const favDel = await req('DELETE', '/api/favorites/'+placeId);
  console.log((ok(favDel.status)?'✓':'✗')+' Favorite DEL: '+(favDel.body.message||favDel.body.error)+' ('+favDel.status+')');

  const rate = await req('POST', '/api/social/stars/rating', {placeId, placeName});
  console.log((rate.status===201||rate.status===429?'✓':'✗')+' Quick rating: '+(rate.status===201?'starEvent='+rate.body.starEvent?.amount+'★':'rate-limited')+' ('+rate.status+')');

  const rec = await req('POST', '/api/social/recommendations', {placeId, placeName, toUserIds:[], message:'Harika!'});
  console.log((ok(rec.status)?'✓':'✗')+' Recommendation: '+rec.body.recommendations?.length+' kayıt, star='+rec.body.starEvent?.amount+'★ ('+rec.status+')');

  const profile = await req('GET', '/api/profile/me');
  console.log((ok(profile.status)?'✓':'✗')+' Profile: '+profile.body.displayName+', stars='+profile.body.starCount+' ('+profile.status+')');

  const stars = await req('GET', '/api/social/stars');
  console.log((ok(stars.status)?'✓':'✗')+' StarEvents: '+stars.body.length+' event ('+stars.status+')');
}
run().catch(e => console.error('HATA:', e.message));
