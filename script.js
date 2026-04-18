// INITIALIZARE
firebase.initializeApp(SETARI_FIREBASE);
const auth = firebase.auth();
const db = firebase.firestore();

let categorieCurenta = LISTA_CATEGORII[0].id;
let dezaboneazaMesaje = null;

// CENZURA
function aplicaCenzura(text) {
    if (!text) return "";
    let curat = text;
    const cuvinteBanned = ["prost", "idiot", "nasol", "fraier", "nebun"]; 
    cuvinteBanned.forEach(c => {
        const regex = new RegExp(c, "gi");
        curat = curat.replace(regex, "****");
    });
    return curat;
}

// ASPECT & FUNDAL
window.toggleMeniuAspect = function() {
    const m = document.getElementById('meniu-aspect');
    m.style.display = (m.style.display === 'none') ? 'flex' : 'none';
}

window.schimbaFundal = function(tip) {
    const cont = document.getElementById('mesaje-container');
    if (!cont) return;

    if (tip === 'url') {
        const link = prompt("Introdu link-ul pozei (Direct Image URL):");
        if (link) {
            cont.style.backgroundImage = `url('${link}')`;
            cont.style.backgroundSize = "cover";
            cont.style.backgroundPosition = "center";
            localStorage.setItem('fundal_personalizat', `url('${link}')`);
        }
    } else {
        cont.style.backgroundImage = "none";
        cont.style.backgroundColor = tip;
        localStorage.setItem('fundal_personalizat', tip);
    }
}

// NAVIGARE
window.schimbaSectiunea = function(id) {
    ["login-section", "signup-section", "recovery-section"].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = 'none';
    });
    const tinta = document.getElementById(id);
    if (tinta) tinta.style.display = 'block';
}

window.togglePassword = function(id, icon) {
    const el = document.getElementById(id);
    if (el) {
        el.type = el.type === "password" ? "text" : "password";
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
    }
}

// CATEGORII
window.afiseazaCategorii = function() {
    const c = document.getElementById('categorii-container');
    if (!c) return;
    c.innerHTML = "";
    LISTA_CATEGORII.forEach(cat => {
        const b = document.createElement('button');
        b.innerText = cat.nume;
        b.className = cat.id === categorieCurenta ? "btn-cat activ" : "btn-cat";
        b.onclick = function() { 
            categorieCurenta = cat.id; 
            afiseazaCategorii(); 
            ascultaMesaje(); 
        };
        c.appendChild(b);
    });
}

// REALTIME MESAJE
window.ascultaMesaje = function() {
    if (dezaboneazaMesaje) dezaboneazaMesaje();
    const cont = document.getElementById('mesaje-container');
    if (!cont) return;

    cont.innerHTML = `<p style="text-align:center; color:gray;">Se încarcă...</p>`;

    dezaboneazaMesaje = db.collection("mesaje")
        .where("categorie", "==", categorieCurenta)
        .onSnapshot((snap) => {
            cont.innerHTML = "";
            let colectie = [];
            snap.forEach(doc => { colectie.push({ id: doc.id, ...doc.data() }); });

            colectie.sort((a, b) => {
                const tA = a.ora ? (a.ora.seconds || Date.now()/1000) : Date.now()/1000;
                const tB = b.ora ? (b.ora.seconds || Date.now()/1000) : Date.now()/1000;
                return tA - tB;
            });

            colectie.forEach(m => {
                const user = auth.currentUser;
                const eAutor = user && m.uid === user.uid;
                const euSuntOwner = user && user.email === EMAIL_OWNER;
                const autorulEsteOwner = m.email === EMAIL_OWNER;

                let oraF = "acum";
                if (m.ora && m.ora.seconds) {
                    oraF = new Date(m.ora.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                const div = document.createElement('div');
                div.className = eAutor ? "msg-dreapta" : "msg-stanga";
                if (autorulEsteOwner) div.classList.add("owner-style");

                let continut = m.foto ? `<img src="${m.foto}" class="img-msg">` : `<div class="bula">${m.text}</div>`;
                let numeAfisat = autorulEsteOwner ? `👑 ${m.nume}` : m.nume;
                let btnSterge = (eAutor || euSuntOwner) ? `<span onclick="sterge('${m.id}')" class="del">Șterge</span>` : "";

                div.innerHTML = `<div class="meta">${numeAfisat} • ${oraF}</div>${continut}${btnSterge}`;
                cont.appendChild(div);
            });
            cont.scrollTop = cont.scrollHeight;
        });
}

// TRIMITE
window.trimiteMesaj = function() {
    const i = document.getElementById('mesaj-text');
    if (i && i.value.trim() && auth.currentUser) {
        db.collection("mesaje").add({
            text: aplicaCenzura(i.value),
            foto: "",
            nume: auth.currentUser.displayName || "Utilizator",
            email: auth.currentUser.email,
            uid: auth.currentUser.uid,
            ora: firebase.firestore.FieldValue.serverTimestamp(),
            categorie: categorieCurenta
        });
        i.value = "";
    }
}

// AUTH
window.verificareLogare = function() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(e, p).then(() => {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('home-section').style.display = 'flex';
        document.getElementById('nume-utilizator').innerText = auth.currentUser.displayName || "Utilizator";
        
        // Incarca fundalul salvat
        const f = localStorage.getItem('fundal_personalizat');
        if(f) {
            const cont = document.getElementById('mesaje-container');
            if(f.includes('url')) { cont.style.backgroundImage = f; cont.style.backgroundSize="cover"; }
            else { cont.style.backgroundColor = f; }
        }

        afiseazaCategorii();
        ascultaMesaje();
    }).catch(err => alert("Eroare Login: " + err.message));
}

window.verificareSignup = function() {
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-pass').value;
    const n = document.getElementById('signup-nume').value;
    auth.createUserWithEmailAndPassword(e, p).then(res => res.user.updateProfile({ displayName: n }))
    .then(() => { alert("Cont creat!"); location.reload(); }).catch(err => alert(err.message));
}

// ALTE FUNCTII
window.incarcaFoto = async function(input) {
    const file = input.files[0]; if (!file) return;
    const fd = new FormData(); fd.append("image", file);
    try {
        const r = await fetch(`https://api.imgbb.com/1/upload?key=${CHEIE_IMGBB}`, { method: "POST", body: fd });
        const d = await r.json();
        if (d.success) db.collection("mesaje").add({
            text: "", foto: d.data.url, nume: auth.currentUser.displayName,
            email: auth.currentUser.email, uid: auth.currentUser.uid,
            ora: firebase.firestore.FieldValue.serverTimestamp(), categorie: categorieCurenta
        });
    } catch (e) { alert("Eroare foto!"); }
}

window.verificareRecovery = function() {
    const e = document.getElementById('recovery-email').value;
    auth.sendPasswordResetEmail(e).then(() => alert("Email trimis!")).catch(err => alert(err.message));
}

window.deschideSuport = function() {
    const m = document.getElementById('suport-modal');
    const l = document.getElementById('lista-faq');
    l.innerHTML = "";
    INTREBARI_AJUTOR.forEach(i => { l.innerHTML += `<div class="faq-item"><strong>${i.q}</strong><p>${i.a}</p></div>`; });
    m.style.display = "block";
}
window.inchideSuport = function() { document.getElementById('suport-modal').style.display = "none"; }
window.deconectare = function() { auth.signOut().then(() => location.reload()); }
window.sterge = function(id) { if (confirm("Ștergi?")) db.collection("mesaje").doc(id).delete(); }
document.addEventListener('keypress', e => { if (e.key === 'Enter') trimiteMesaj(); });