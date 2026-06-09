/**
 * seed-wc2026.ts — Full WC 2026 player pool
 * 32 nations × 23 players (3 GK · 8 DEF · 8 MID · 4 FWD) = 736 players
 * club = national team name · clubShortName = 3-letter code
 *
 * Run: pnpm --filter @workspace/scripts run seed-wc2026
 */

import { db, playersTable, teamsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

// ─── Pricing ──────────────────────────────────────────────────────────────────

const TIER1 = new Set(["Argentina","Brazil","England","France","Germany","Netherlands","Portugal","Spain","Belgium"]);
const TIER2 = new Set(["Australia","Canada","Croatia","Denmark","Ecuador","Japan","Mexico","Morocco","Poland","Saudi Arabia","Senegal","Serbia","South Korea","Switzerland","Uruguay","USA"]);

// Fixed prices for recognisable stars
const STAR: Record<string, number> = {
  "Lionel Messi": 12.5, "Julián Álvarez": 9.5, "Lautaro Martínez": 9.0,
  "Emiliano Martínez": 6.0,
  "Vinicius Junior": 13.0, "Raphinha": 9.5, "Rodrygo": 9.0,
  "Alisson Becker": 6.0, "Ederson": 5.5,
  "Kylian Mbappé": 13.5, "Antoine Griezmann": 9.0, "Ousmane Dembélé": 8.5,
  "Hugo Lloris": 5.5, "Mike Maignan": 5.5,
  "Harry Kane": 11.0, "Bukayo Saka": 10.5, "Jude Bellingham": 11.5,
  "Phil Foden": 10.0, "Declan Rice": 8.5,
  "Jordan Pickford": 5.0,
  "Álvaro Morata": 8.0, "Lamine Yamal": 11.0, "Pedri": 9.5, "Rodri": 9.0,
  "Unai Simón": 5.0,
  "Manuel Neuer": 5.0, "Jamal Musiala": 9.0, "Florian Wirtz": 9.0,
  "Cristiano Ronaldo": 9.5, "Bruno Fernandes": 9.0, "Rafael Leão": 9.5,
  "Diogo Costa": 5.0,
  "Virgil van Dijk": 7.0, "Cody Gakpo": 8.5, "Xavi Simons": 8.5,
  "Bart Verbruggen": 5.0,
  "Thibaut Courtois": 6.0, "Kevin De Bruyne": 10.5, "Romelu Lukaku": 8.5,
  "Luka Modrić": 8.5, "Joško Gvardiol": 7.0, "Andrej Kramarić": 8.0,
  "Dominik Livaković": 5.0,
  "Christian Pulisic": 8.5, "Folarin Balogun": 7.5,
  "Matt Turner": 4.5,
  "Hiromi Itakura": 5.0, "Kaoru Mitoma": 8.0, "Takefusa Kubo": 7.5,
  "Achraf Hakimi": 8.0, "Hakim Ziyech": 7.5, "Youssef En-Nesyri": 8.0,
  "Sadio Mané": 8.5, "Nicolas Jackson": 8.0, "Édouard Mendy": 5.0,
  "Alphonso Davies": 7.5, "Jonathan David": 9.0,
  "Moisés Caicedo": 8.0, "Enner Valencia": 7.5,
  "Federico Valverde": 8.5, "Darwin Núñez": 9.0, "Luis Suárez": 7.5,
  "Granit Xhaka": 7.0, "Breel Embolo": 7.5,
  "Robert Lewandowski": 9.5, "Piotr Zieliński": 7.5,
  "Rasmus Højlund": 8.5, "Christian Eriksen": 7.5,
  "Aleksandar Mitrović": 9.0, "Dušan Vlahović": 8.5,
  "Son Heung-min": 9.5, "Kim Min-jae": 7.0,
  "Mohammed Kudus": 7.5, "Thomas Partey": 7.0,
  "André Onana": 5.5, "Bryan Mbeumo": 7.5, "Vincent Aboubakar": 7.0,
  "Mehdi Taremi": 7.5, "Sardar Azmoun": 7.0,
  "Keylor Navas": 5.0, "Joel Campbell": 6.5,
  "Guillermo Ochoa": 4.5, "Santiago Giménez": 8.0, "Raúl Jiménez": 7.5,
  "Erling Haaland": 14.0,
  "Salem Al-Dawsari": 6.5,
};

type Pos = "GK" | "DEF" | "MID" | "FWD";

const RANGES: Record<Pos, { t1: [number,number]; t2: [number,number]; t3: [number,number] }> = {
  GK:  { t1:[5.0,6.0], t2:[4.5,5.5], t3:[4.0,5.0] },
  DEF: { t1:[5.5,7.5], t2:[4.5,6.5], t3:[4.0,5.5] },
  MID: { t1:[6.5,9.5], t2:[5.5,8.0], t3:[5.0,6.5] },
  FWD: { t1:[8.0,12.0], t2:[6.5,9.5], t3:[6.0,8.0] },
};

function price(name: string, pos: Pos, nation: string): number {
  if (STAR[name] !== undefined) return STAR[name];
  const [lo, hi] = TIER1.has(nation) ? RANGES[pos].t1 : TIER2.has(nation) ? RANGES[pos].t2 : RANGES[pos].t3;
  return parseFloat((lo + Math.random() * (hi - lo)).toFixed(1));
}

// ─── Nation code map ───────────────────────────────────────────────────────────

const CODE: Record<string, string> = {
  Argentina: "ARG", France: "FRA", Brazil: "BRA", England: "ENG",
  Spain: "ESP", Germany: "GER", Portugal: "POR", Netherlands: "NED",
  Belgium: "BEL", Croatia: "CRO", USA: "USA", Mexico: "MEX",
  Japan: "JPN", Morocco: "MAR", Senegal: "SEN", Australia: "AUS",
  Canada: "CAN", Ecuador: "ECU", Uruguay: "URU", Switzerland: "SUI",
  Poland: "POL", Denmark: "DEN", Serbia: "SRB", "South Korea": "KOR",
  Ghana: "GHA", Cameroon: "CMR", Tunisia: "TUN", "Saudi Arabia": "KSA",
  Iran: "IRN", "Costa Rica": "CRC", Wales: "WAL", Qatar: "QAT",
};

// ─── Player roster: [name, position] — exactly 3 GK · 8 DEF · 8 MID · 4 FWD per nation ──

type P = [string, Pos];

const NATIONS: Array<{ name: string; squad: P[] }> = [
  { name: "Argentina", squad: [
    // GK
    ["Emiliano Martínez","GK"],["Gerónimo Rulli","GK"],["Franco Armani","GK"],
    // DEF
    ["Cristian Romero","DEF"],["Lisandro Martínez","DEF"],["Nicolás Otamendi","DEF"],
    ["Nahuel Molina","DEF"],["Marcos Acuña","DEF"],["Nicolás Tagliafico","DEF"],
    ["Gonzalo Montiel","DEF"],["Germán Pezzella","DEF"],
    // MID
    ["Rodrigo De Paul","MID"],["Leandro Paredes","MID"],["Enzo Fernández","MID"],
    ["Alexis Mac Allister","MID"],["Giovani Lo Celso","MID"],["Guido Rodríguez","MID"],
    ["Exequiel Palacios","MID"],["Valentín Carboni","MID"],
    // FWD
    ["Lionel Messi","FWD"],["Julián Álvarez","FWD"],["Lautaro Martínez","FWD"],["Alejandro Garnacho","FWD"],
  ]},
  { name: "France", squad: [
    ["Hugo Lloris","GK"],["Mike Maignan","GK"],["Alphonse Areola","GK"],
    ["Raphaël Varane","DEF"],["Jules Koundé","DEF"],["Ibrahima Konaté","DEF"],
    ["William Saliba","DEF"],["Benjamin Pavard","DEF"],["Théo Hernandez","DEF"],
    ["Lucas Hernandez","DEF"],["Jonathan Clauss","DEF"],
    ["N'Golo Kanté","MID"],["Aurélien Tchouaméni","MID"],["Adrien Rabiot","MID"],
    ["Eduardo Camavinga","MID"],["Youssouf Fofana","MID"],["Warren Zaïre-Emery","MID"],
    ["Mattéo Guendouzi","MID"],["Khephren Thuram","MID"],
    ["Kylian Mbappé","FWD"],["Antoine Griezmann","FWD"],["Ousmane Dembélé","FWD"],["Marcus Thuram","FWD"],
  ]},
  { name: "Brazil", squad: [
    ["Alisson Becker","GK"],["Ederson","GK"],["Weverton","GK"],
    ["Marquinhos","DEF"],["Gabriel Magalhães","DEF"],["Éder Militão","DEF"],
    ["Danilo","DEF"],["Alex Sandro","DEF"],["Guilherme Arana","DEF"],
    ["Alex Telles","DEF"],["Bremer","DEF"],
    ["Casemiro","MID"],["Lucas Paquetá","MID"],["Bruno Guimarães","MID"],
    ["Fabinho","MID"],["Gerson","MID"],["Éverton Ribeiro","MID"],
    ["Andreas Pereira","MID"],["Douglas Luiz","MID"],
    ["Vinicius Junior","FWD"],["Raphinha","FWD"],["Rodrygo","FWD"],["Richarlison","FWD"],
  ]},
  { name: "England", squad: [
    ["Jordan Pickford","GK"],["Nick Pope","GK"],["Aaron Ramsdale","GK"],
    ["Trent Alexander-Arnold","DEF"],["Kieran Trippier","DEF"],["Luke Shaw","DEF"],
    ["John Stones","DEF"],["Marc Guehi","DEF"],["Harry Maguire","DEF"],
    ["Reece James","DEF"],["Ben White","DEF"],
    ["Jude Bellingham","MID"],["Declan Rice","MID"],["Phil Foden","MID"],
    ["Bukayo Saka","MID"],["Conor Gallagher","MID"],["James Maddison","MID"],
    ["Cole Palmer","MID"],["Morgan Gibbs-White","MID"],
    ["Harry Kane","FWD"],["Marcus Rashford","FWD"],["Ollie Watkins","FWD"],["Jarrod Bowen","FWD"],
  ]},
  { name: "Spain", squad: [
    ["Unai Simón","GK"],["David Raya","GK"],["Robert Sánchez","GK"],
    ["Dani Carvajal","DEF"],["Pau Cubarsí","DEF"],["Robin Le Normand","DEF"],
    ["Aymeric Laporte","DEF"],["Alejandro Balde","DEF"],["Nacho","DEF"],
    ["Jesús Navas","DEF"],["Alejandro Grimaldo","DEF"],
    ["Pedri","MID"],["Rodri","MID"],["Fabián Ruiz","MID"],
    ["Gavi","MID"],["Dani Olmo","MID"],["Mikel Merino","MID"],
    ["Martín Zubimendi","MID"],["Alex Baena","MID"],
    ["Lamine Yamal","FWD"],["Álvaro Morata","FWD"],["Nico Williams","FWD"],["Mikel Oyarzabal","FWD"],
  ]},
  { name: "Germany", squad: [
    ["Manuel Neuer","GK"],["Marc-André ter Stegen","GK"],["Oliver Baumann","GK"],
    ["Antonio Rüdiger","DEF"],["Joshua Kimmich","DEF"],["Nico Schlotterbeck","DEF"],
    ["David Raum","DEF"],["Thilo Kehrer","DEF"],["Benjamin Henrichs","DEF"],
    ["Matthias Ginter","DEF"],["Robin Gosens","DEF"],
    ["Ilkay Gündogan","MID"],["Leon Goretzka","MID"],["Kai Havertz","MID"],
    ["Jamal Musiala","MID"],["Florian Wirtz","MID"],["Julian Brandt","MID"],
    ["Robert Andrich","MID"],["Leroy Sané","MID"],
    ["Niclas Füllkrug","FWD"],["Thomas Müller","FWD"],["Karim Adeyemi","FWD"],["Maximilian Beier","FWD"],
  ]},
  { name: "Portugal", squad: [
    ["Diogo Costa","GK"],["Rui Patrício","GK"],["José Sá","GK"],
    ["Rúben Dias","DEF"],["Pepe","DEF"],["João Cancelo","DEF"],
    ["Nuno Mendes","DEF"],["António Silva","DEF"],["Gonçalo Inácio","DEF"],
    ["Nelson Semedo","DEF"],["Danilo Pereira","DEF"],
    ["Bruno Fernandes","MID"],["Bernardo Silva","MID"],["Vitinha","MID"],
    ["João Palhinha","MID"],["Rúben Neves","MID"],["Matheus Nunes","MID"],
    ["Otávio","MID"],["Francisco Conceição","MID"],
    ["Cristiano Ronaldo","FWD"],["Rafael Leão","FWD"],["Gonçalo Ramos","FWD"],["João Félix","FWD"],
  ]},
  { name: "Netherlands", squad: [
    ["Bart Verbruggen","GK"],["Remko Pasveer","GK"],["Mark Flekken","GK"],
    ["Virgil van Dijk","DEF"],["Matthijs de Ligt","DEF"],["Stefan de Vrij","DEF"],
    ["Denzel Dumfries","DEF"],["Nathan Aké","DEF"],["Jurriën Timber","DEF"],
    ["Jeremie Frimpong","DEF"],["Daley Blind","DEF"],
    ["Frenkie de Jong","MID"],["Ryan Gravenberch","MID"],["Tijjani Reijnders","MID"],
    ["Xavi Simons","MID"],["Teun Koopmeiners","MID"],["Marten de Roon","MID"],
    ["Quinten Timber","MID"],["Jerdy Schouten","MID"],
    ["Cody Gakpo","FWD"],["Memphis Depay","FWD"],["Wout Weghorst","FWD"],["Brian Brobbey","FWD"],
  ]},
  { name: "Belgium", squad: [
    ["Thibaut Courtois","GK"],["Simon Mignolet","GK"],["Koen Casteels","GK"],
    ["Zeno Debast","DEF"],["Arthur Theate","DEF"],["Jan Vertonghen","DEF"],
    ["Toby Alderweireld","DEF"],["Timothy Castagne","DEF"],["Thomas Meunier","DEF"],
    ["Axel Witsel","DEF"],["Wout Faes","DEF"],
    ["Kevin De Bruyne","MID"],["Youri Tielemans","MID"],["Amadou Onana","MID"],
    ["Leandro Trossard","MID"],["Charles De Ketelaere","MID"],["Orel Mangala","MID"],
    ["Hans Vanaken","MID"],["Alexis Saelemaekers","MID"],
    ["Romelu Lukaku","FWD"],["Loïs Openda","FWD"],["Jeremy Doku","FWD"],["Johan Bakayoko","FWD"],
  ]},
  { name: "Croatia", squad: [
    ["Dominik Livaković","GK"],["Ivica Ivušić","GK"],["Lovre Kalinić","GK"],
    ["Joško Gvardiol","DEF"],["Dejan Lovren","DEF"],["Josip Stanišić","DEF"],
    ["Borna Ćaleta-Car","DEF"],["Martin Erlić","DEF"],["Šime Vrsaljko","DEF"],
    ["Borna Sosa","DEF"],["Josip Juranović","DEF"],
    ["Luka Modrić","MID"],["Mateo Kovačić","MID"],["Marcelo Brozović","MID"],
    ["Nikola Vlašić","MID"],["Mario Pašalić","MID"],["Ivan Perišić","MID"],
    ["Lovro Majer","MID"],["Kristijan Jakić","MID"],
    ["Andrej Kramarić","FWD"],["Bruno Petković","FWD"],["Marko Livaja","FWD"],["Luka Ivanušec","FWD"],
  ]},
  { name: "USA", squad: [
    ["Matt Turner","GK"],["Ethan Horvath","GK"],["Patrick Schulte","GK"],
    ["Sergiño Dest","DEF"],["Antonee Robinson","DEF"],["Walker Zimmerman","DEF"],
    ["Miles Robinson","DEF"],["Joe Scally","DEF"],["DeAndre Yedlin","DEF"],
    ["Cameron Carter-Vickers","DEF"],["Chris Richards","DEF"],
    ["Tyler Adams","MID"],["Weston McKennie","MID"],["Yunus Musah","MID"],
    ["Christian Pulisic","MID"],["Gio Reyna","MID"],["Brenden Aaronson","MID"],
    ["Luca de la Torre","MID"],["Malik Tillman","MID"],
    ["Folarin Balogun","FWD"],["Ricardo Pepi","FWD"],["Josh Sargent","FWD"],["Jesus Ferreira","FWD"],
  ]},
  { name: "Mexico", squad: [
    ["Guillermo Ochoa","GK"],["Luis Malagón","GK"],["Rodolfo Cota","GK"],
    ["Jorge Sánchez","DEF"],["César Montes","DEF"],["Johan Vásquez","DEF"],
    ["Gerardo Arteaga","DEF"],["Kevin Álvarez","DEF"],["Jesús Gallardo","DEF"],
    ["Héctor Moreno","DEF"],["Jorge Mere","DEF"],
    ["Edson Álvarez","MID"],["Héctor Herrera","MID"],["Orbelín Pineda","MID"],
    ["Chucky Lozano","MID"],["Roberto Alvarado","MID"],["Luis Romo","MID"],
    ["Uriel Antuna","MID"],["Erick Gutiérrez","MID"],
    ["Raúl Jiménez","FWD"],["Santiago Giménez","FWD"],["Henry Martín","FWD"],["Alexis Vega","FWD"],
  ]},
  { name: "Japan", squad: [
    ["Zion Suzuki","GK"],["Shuichi Gonda","GK"],["Daniel Schmidt","GK"],
    ["Takehiro Tomiyasu","DEF"],["Ko Itakura","DEF"],["Maya Yoshida","DEF"],
    ["Miki Yamane","DEF"],["Yuta Nakayama","DEF"],["Shogo Taniguchi","DEF"],
    ["Hiroki Ito","DEF"],["Ryusei Doan","DEF"],
    ["Wataru Endo","MID"],["Hidemasa Morita","MID"],["Kaoru Mitoma","MID"],
    ["Takefusa Kubo","MID"],["Daichi Kamada","MID"],["Ritsu Doan","MID"],
    ["Junya Ito","MID"],["Ao Tanaka","MID"],
    ["Ayase Ueda","FWD"],["Genki Haraguchi","FWD"],["Yuya Osako","FWD"],["Naoki Maeda","FWD"],
  ]},
  { name: "Morocco", squad: [
    ["Yassine Bounou","GK"],["Ahmed Reda Tagnaouti","GK"],["Munir Mohamedi","GK"],
    ["Achraf Hakimi","DEF"],["Romain Saïss","DEF"],["Nayef Aguerd","DEF"],
    ["Noussair Mazraoui","DEF"],["Achraf Dari","DEF"],["Jawad El Yamiq","DEF"],
    ["Badr Benoun","DEF"],["Adam Masina","DEF"],
    ["Sofyan Amrabat","MID"],["Selim Amallah","MID"],["Hakim Ziyech","MID"],
    ["Azzedine Ounahi","MID"],["Bilal El Khannouss","MID"],["Abde Ezzalzouli","MID"],
    ["Ilias Chair","MID"],["Yahya Jabrane","MID"],
    ["Youssef En-Nesyri","FWD"],["Sofiane Boufal","FWD"],["Ayoub El Kaabi","FWD"],["Anass Zaroury","FWD"],
  ]},
  { name: "Senegal", squad: [
    ["Édouard Mendy","GK"],["Alfred Gomis","GK"],["Seny Dieng","GK"],
    ["Kalidou Koulibaly","DEF"],["Abdou Diallo","DEF"],["Moussa Niakhaté","DEF"],
    ["Youssouf Sabaly","DEF"],["Fodé Ballo-Touré","DEF"],["Ismail Jakobs","DEF"],
    ["Formose Mendy","DEF"],["Pape Abou Cissé","DEF"],
    ["Idrissa Gana Gueye","MID"],["Cheikhou Kouyaté","MID"],["Pape Guèye","MID"],
    ["Lamine Camara","MID"],["Nampalys Mendy","MID"],["Krepin Diatta","MID"],
    ["Iliman Ndiaye","MID"],["Ismaila Sarr","MID"],
    ["Sadio Mané","FWD"],["Nicolas Jackson","FWD"],["Bamba Dieng","FWD"],["Habib Diallo","FWD"],
  ]},
  { name: "Australia", squad: [
    ["Mat Ryan","GK"],["Andrew Redmayne","GK"],["Danny Vukovic","GK"],
    ["Harry Souttar","DEF"],["Bailey Wright","DEF"],["Miloš Degenek","DEF"],
    ["Nathaniel Atkinson","DEF"],["Joel King","DEF"],["Aziz Behich","DEF"],
    ["Thomas Deng","DEF"],["Fran Karacic","DEF"],
    ["Aaron Mooy","MID"],["Jackson Irvine","MID"],["Riley McGree","MID"],
    ["Ajdin Hrustic","MID"],["Keanu Baccus","MID"],["Martin Boyle","MID"],
    ["Connor Metcalfe","MID"],["Cameron Devlin","MID"],
    ["Mathew Leckie","FWD"],["Mitch Duke","FWD"],["Craig Goodwin","FWD"],["Garang Kuol","FWD"],
  ]},
  { name: "Canada", squad: [
    ["Milan Borjan","GK"],["Maxime Crépeau","GK"],["James Pantemis","GK"],
    ["Alphonso Davies","DEF"],["Alistair Johnston","DEF"],["Kamal Miller","DEF"],
    ["Steven Vitória","DEF"],["Derek Cornelius","DEF"],["Sam Adekugbe","DEF"],
    ["Joel Waterman","DEF"],["Doneil Henry","DEF"],
    ["Stephen Eustáquio","MID"],["Atiba Hutchinson","MID"],["Jonathan Osorio","MID"],
    ["Tajon Buchanan","MID"],["Ismaël Koné","MID"],["Mark-Anthony Kaye","MID"],
    ["Richie Laryea","MID"],["Junior Hoilett","MID"],
    ["Jonathan David","FWD"],["Cyle Larin","FWD"],["Liam Millar","FWD"],["Charles-Andreas Brym","FWD"],
  ]},
  { name: "Ecuador", squad: [
    ["Hernán Galíndez","GK"],["Alexander Domínguez","GK"],["Carlos Heras","GK"],
    ["Piero Hincapié","DEF"],["Byron Castillo","DEF"],["Félix Torres","DEF"],
    ["Jackson Porozo","DEF"],["Diego Palacios","DEF"],["Xavier Arreaga","DEF"],
    ["Ángelo Preciado","DEF"],["Pervis Estupiñán","DEF"],
    ["Moisés Caicedo","MID"],["Carlos Gruezo","MID"],["Ángel Mena","MID"],
    ["Gonzalo Plata","MID"],["Jeremy Sarmiento","MID"],["Alan Minda","MID"],
    ["Jhegson Méndez","MID"],["Romario Ibarra","MID"],
    ["Enner Valencia","FWD"],["Michael Estrada","FWD"],["Jordy Caicedo","FWD"],["Djorkaeff Reasco","FWD"],
  ]},
  { name: "Uruguay", squad: [
    ["Sergio Rochet","GK"],["Fernando Muslera","GK"],["Sebastián Sosa","GK"],
    ["Ronald Araújo","DEF"],["José María Giménez","DEF"],["Diego Godín","DEF"],
    ["Mathías Olivera","DEF"],["Nahitan Nández","DEF"],["Sebastián Coates","DEF"],
    ["Matías Viña","DEF"],["Diego Godin","DEF"],
    ["Federico Valverde","MID"],["Rodrigo Bentancur","MID"],["Manuel Ugarte","MID"],
    ["Lucas Torreira","MID"],["Giorgian de Arrascaeta","MID"],["Nicolás de la Cruz","MID"],
    ["Gastón Pereiro","MID"],["Brian Rodríguez","MID"],
    ["Darwin Núñez","FWD"],["Luis Suárez","FWD"],["Facundo Torres","FWD"],["Facundo Pellistri","FWD"],
  ]},
  { name: "Switzerland", squad: [
    ["Gregor Kobel","GK"],["Yann Sommer","GK"],["Jonas Omlin","GK"],
    ["Manuel Akanji","DEF"],["Fabian Schär","DEF"],["Nico Elvedi","DEF"],
    ["Ricardo Rodriguez","DEF"],["Silvan Widmer","DEF"],["Kevin Mbabu","DEF"],
    ["Becir Omeragic","DEF"],["Loris Benito","DEF"],
    ["Granit Xhaka","MID"],["Remo Freuler","MID"],["Xherdan Shaqiri","MID"],
    ["Denis Zakaria","MID"],["Michel Aebischer","MID"],["Steven Zuber","MID"],
    ["Dan Ndoye","MID"],["Fabian Rieder","MID"],
    ["Breel Embolo","FWD"],["Haris Seferović","FWD"],["Ruben Vargas","FWD"],["Zeki Amdouni","FWD"],
  ]},
  { name: "Poland", squad: [
    ["Wojciech Szczęsny","GK"],["Łukasz Fabiański","GK"],["Bartłomiej Drągowski","GK"],
    ["Kamil Glik","DEF"],["Jan Bednarek","DEF"],["Jakub Kiwior","DEF"],
    ["Bartosz Bereszyński","DEF"],["Matty Cash","DEF"],["Paweł Dawidowicz","DEF"],
    ["Tymoteusz Puchacz","DEF"],["Mateusz Wieteska","DEF"],
    ["Piotr Zieliński","MID"],["Grzegorz Krychowiak","MID"],["Sebastian Szymański","MID"],
    ["Przemysław Frankowski","MID"],["Jakub Kamiński","MID"],["Nicola Zalewski","MID"],
    ["Mateusz Klich","MID"],["Kacper Urbański","MID"],
    ["Robert Lewandowski","FWD"],["Arkadiusz Milik","FWD"],["Karol Świderski","FWD"],["Adam Buksa","FWD"],
  ]},
  { name: "Denmark", squad: [
    ["Kasper Schmeichel","GK"],["Oliver Christensen","GK"],["Frederik Rønnow","GK"],
    ["Simon Kjær","DEF"],["Andreas Christensen","DEF"],["Joachim Andersen","DEF"],
    ["Joakim Mæhle","DEF"],["Víctor Nelsson","DEF"],["Alexander Bah","DEF"],
    ["Jens Stryger Larsen","DEF"],["Daniel Wass","DEF"],
    ["Christian Eriksen","MID"],["Pierre-Emile Højbjerg","MID"],["Thomas Delaney","MID"],
    ["Mikkel Damsgaard","MID"],["Andreas Skov Olsen","MID"],["Jesper Lindstrøm","MID"],
    ["Mathias Jensen","MID"],["Albert Grønbæk","MID"],
    ["Rasmus Højlund","FWD"],["Jonas Wind","FWD"],["Kasper Dolberg","FWD"],["Andreas Cornelius","FWD"],
  ]},
  { name: "Serbia", squad: [
    ["Predrag Rajković","GK"],["Vanja Milinković-Savić","GK"],["Marko Dmitrović","GK"],
    ["Strahinja Pavlović","DEF"],["Nikola Milenković","DEF"],["Miloš Veljković","DEF"],
    ["Strahinja Eraković","DEF"],["Filip Mladenović","DEF"],["Srđan Babić","DEF"],
    ["Nemanja Gudelj","DEF"],["Miloš Spajić","DEF"],
    ["Sergej Milinković-Savić","MID"],["Saša Lukić","MID"],["Filip Kostić","MID"],
    ["Ivan Ilić","MID"],["Dušan Tadić","MID"],["Lazar Samardžić","MID"],
    ["Marko Grujić","MID"],["Andrija Živković","MID"],
    ["Aleksandar Mitrović","FWD"],["Dušan Vlahović","FWD"],["Luka Jović","FWD"],["Nemanja Radonjić","FWD"],
  ]},
  { name: "South Korea", squad: [
    ["Kim Seung-gyu","GK"],["Jo Hyeon-woo","GK"],["Song Bum-keun","GK"],
    ["Kim Min-jae","DEF"],["Kim Young-gwon","DEF"],["Jung Seung-hyun","DEF"],
    ["Kim Jin-su","DEF"],["Kim Tae-hwan","DEF"],["Yoon Jong-gyu","DEF"],
    ["Lee Kang-in","DEF"],["Hong Chul","DEF"],
    ["Son Heung-min","MID"],["Hwang In-beom","MID"],["Lee Jae-sung","MID"],
    ["Paik Seung-ho","MID"],["Jung Woo-young","MID"],["Na Sang-ho","MID"],
    ["Kwon Chang-hoon","MID"],["Lee Kang-in","MID"],
    ["Hwang Hee-chan","FWD"],["Cho Gue-sung","FWD"],["Oh Hyeon-gyu","FWD"],["Lee Seung-woo","FWD"],
  ]},
  { name: "Ghana", squad: [
    ["Lawrence Ati-Zigi","GK"],["Joseph Wollacott","GK"],["Richard Ofori","GK"],
    ["Daniel Amartey","DEF"],["Alexander Djiku","DEF"],["Tariq Lamptey","DEF"],
    ["Baba Rahman","DEF"],["Gideon Mensah","DEF"],["Jonathan Mensah","DEF"],
    ["Denis Odoi","DEF"],["Abdul Mumin","DEF"],
    ["Thomas Partey","MID"],["Iddrisu Baba","MID"],["André Ayew","MID"],
    ["Jordan Ayew","MID"],["Kudus Mohammed","MID"],["Osman Bukari","MID"],
    ["Salis Abdul Samed","MID"],["Daniel Kofi Kyereh","MID"],
    ["Mohammed Kudus","FWD"],["Iñaki Williams","FWD"],["Antoine Semenyo","FWD"],["Ernest Nuamah","FWD"],
  ]},
  { name: "Cameroon", squad: [
    ["André Onana","GK"],["Devis Epassy","GK"],["Simon Omossola","GK"],
    ["Collins Fai","DEF"],["Michael Ngadeu-Ngadjui","DEF"],["Nouhou","DEF"],
    ["Jean-Charles Castelletto","DEF"],["Harold Moukoudi","DEF"],["Ambroise Oyongo","DEF"],
    ["Nicolas Nkoulou","DEF"],["Enzo Ebosse","DEF"],
    ["Frank Zambo Anguissa","MID"],["Samuel Gouet","MID"],["Martin Hongla","MID"],
    ["Pierre Kunde","MID"],["Olivier Ntcham","MID"],["Gaël Ondoua","MID"],
    ["Moumi Ngamaleu","MID"],["James Léa Siliki","MID"],
    ["Vincent Aboubakar","FWD"],["Bryan Mbeumo","FWD"],["Karl Toko Ekambi","FWD"],["Jean-Pierre Nsame","FWD"],
  ]},
  { name: "Tunisia", squad: [
    ["Aymen Dahmen","GK"],["Béchir Ben Said","GK"],["Farouk Ben Mustapha","GK"],
    ["Dylan Bronn","DEF"],["Montassar Talbi","DEF"],["Wajdi Kechrida","DEF"],
    ["Ali Maaloul","DEF"],["Nader Ghandri","DEF"],["Hamza Mathlouthi","DEF"],
    ["Bilel Ifa","DEF"],["Yassine Meriah","DEF"],
    ["Aïssa Laïdouni","MID"],["Ellyes Skhiri","MID"],["Ferjani Sassi","MID"],
    ["Hannibal Mejbri","MID"],["Saif-Eddine Khaoui","MID"],["Naïm Sliti","MID"],
    ["Mohamed Ali Ben Romdhane","MID"],["Eray Cömert","MID"],
    ["Wahbi Khazri","FWD"],["Issam Jebali","FWD"],["Seifeddine Jaziri","FWD"],["Youssef Msakni","FWD"],
  ]},
  { name: "Saudi Arabia", squad: [
    ["Mohammed Al-Owais","GK"],["Fawaz Al-Qarni","GK"],["Yasser Al-Mosailem","GK"],
    ["Saud Abdulhamid","DEF"],["Ali Al-Bulayhi","DEF"],["Hassan Tambakti","DEF"],
    ["Yasser Al-Shahrani","DEF"],["Mohammed Al-Breik","DEF"],["Abdullah Madu","DEF"],
    ["Abdulelah Al-Amri","DEF"],["Sultan Al-Ghannam","DEF"],
    ["Salman Al-Faraj","MID"],["Mohammed Kanno","MID"],["Ali Al-Hassan","MID"],
    ["Salem Al-Dawsari","MID"],["Abdullah Al-Hamdan","MID"],["Hattan Bahebri","MID"],
    ["Ali Al-Nimer","MID"],["Nasser Al-Dawsari","MID"],
    ["Firas Al-Buraikan","FWD"],["Saleh Al-Shehri","FWD"],["Abdullah Al-Khaibari","FWD"],["Mukhtar Ali","FWD"],
  ]},
  { name: "Iran", squad: [
    ["Alireza Beiranvand","GK"],["Hossein Hosseini","GK"],["Payam Niazmand","GK"],
    ["Shoja Khalilzadeh","DEF"],["Majid Hosseini","DEF"],["Milad Mohammadi","DEF"],
    ["Roozbeh Cheshmi","DEF"],["Sadegh Moharrami","DEF"],["Hossein Kanaanizadegan","DEF"],
    ["Abolfazl Jalali","DEF"],["Amin Hazbavi","DEF"],
    ["Saeid Ezatolahi","MID"],["Ali Gholizadeh","MID"],["Saman Ghoddos","MID"],
    ["Alireza Jahanbakhsh","MID"],["Mehdi Torabi","MID"],["Vahid Amiri","MID"],
    ["Ahmad Nourollahi","MID"],["Omid Alishah","MID"],
    ["Mehdi Taremi","FWD"],["Sardar Azmoun","FWD"],["Karim Ansarifard","FWD"],["Allahyar Sayyadmanesh","FWD"],
  ]},
  { name: "Costa Rica", squad: [
    ["Keylor Navas","GK"],["Patrick Sequeira","GK"],["Esteban Alvarado","GK"],
    ["Bryan Oviedo","DEF"],["Keysher Fuller","DEF"],["Oscar Duarte","DEF"],
    ["Kendall Waston","DEF"],["Carlos Martínez","DEF"],["Juan Pablo Vargas","DEF"],
    ["Ronald Matarrita","DEF"],["Francisco Calvo","DEF"],
    ["Celso Borges","MID"],["Bryan Ruiz","MID"],["Yeltsin Tejeda","MID"],
    ["Rándall Leal","MID"],["Douglas Sequeira","MID"],["Orlando Galo","MID"],
    ["Anthony Hernández","MID"],["Jefferson Brenes","MID"],
    ["Joel Campbell","FWD"],["Johan Venegas","FWD"],["Anthony Contreras","FWD"],["Manfred Ugalde","FWD"],
  ]},
  { name: "Wales", squad: [
    ["Wayne Hennessey","GK"],["Danny Ward","GK"],["Adam Davies","GK"],
    ["Ben Davies","DEF"],["Joe Rodon","DEF"],["Chris Mepham","DEF"],
    ["Connor Roberts","DEF"],["Ethan Ampadu","DEF"],["Neco Williams","DEF"],
    ["Tom Lockyer","DEF"],["Ben Cabango","DEF"],
    ["Aaron Ramsey","MID"],["Joe Allen","MID"],["Harry Wilson","MID"],
    ["Dylan Levitt","MID"],["Matthew Smith","MID"],["Jonny Williams","MID"],
    ["Rubin Colwill","MID"],["Dan James","MID"],
    ["Gareth Bale","FWD"],["Kieffer Moore","FWD"],["Brennan Johnson","FWD"],["Mark Harris","FWD"],
  ]},
  { name: "Qatar", squad: [
    ["Meshaal Barsham","GK"],["Saad Al-Sheeb","GK"],["Yousef Hassan","GK"],
    ["Bassam Al-Rawi","DEF"],["Pedro Miguel","DEF"],["Tarek Salman","DEF"],
    ["Mohammed Waad","DEF"],["Assim Madibo","DEF"],["Yusuf Abdurisag","DEF"],
    ["Homam Ahmed","DEF"],["Abdelkarim Hassan","DEF"],
    ["Akram Afif","MID"],["Hassan Al-Haydos","MID"],["Karim Boudiaf","MID"],
    ["Salem Al-Hajri","MID"],["Boualem Khoukhi","MID"],["Ismaeel Mohammad","MID"],
    ["Abdulaziz Hatem","MID"],["Mostafa Meshaal","MID"],
    ["Almoez Ali","FWD"],["Mohammed Muntari","FWD"],["Abdulrahman Al-Haydos","FWD"],["Khalid Muneer","FWD"],
  ]},
];

// ─── Validate counts ───────────────────────────────────────────────────────────

function validateSquad(name: string, squad: P[]): void {
  const counts: Record<Pos, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const [, pos] of squad) counts[pos]++;
  const ok = counts.GK === 3 && counts.DEF === 8 && counts.MID === 8 && counts.FWD === 4;
  if (!ok) {
    console.warn(`  ⚠ ${name}: GK=${counts.GK} DEF=${counts.DEF} MID=${counts.MID} FWD=${counts.FWD} (expected 3/8/8/4)`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  FIFA World Cup 2026 — Complete Player Pool Seed");
  console.log("═══════════════════════════════════════════════════\n");

  console.log("Validating squad compositions…");
  for (const { name, squad } of NATIONS) validateSquad(name, squad);
  console.log(`✔ ${NATIONS.length} nations validated\n`);

  console.log("Clearing existing players & team rosters…");
  await db.execute(sql`DELETE FROM team_players`);
  await db.execute(sql`DELETE FROM players`);
  await db.execute(sql`ALTER SEQUENCE players_id_seq RESTART WITH 1`);

  const now = new Date();
  let inserted = 0;

  console.log(`Seeding ${NATIONS.length} nations…`);
  for (const { name, squad } of NATIONS) {
    const code = CODE[name] ?? name.slice(0, 3).toUpperCase();
    const rows = squad.map(([playerName, pos]) => ({
      name: playerName,
      position: pos as string,
      club: name,
      clubShortName: code,
      nationality: name,
      price: price(playerName, pos, name),
      totalPoints: 0,
      form: 0,
      selected: 0,
      goalsScored: 0,
      assists: 0,
      cleanSheets: 0,
      cachedFromApi: false,
      cachedAt: now,
    }));
    await db.insert(playersTable).values(rows);
    inserted += rows.length;
    console.log(`  ✔ ${name} (${code}): ${rows.length} players`);
  }

  console.log(`\n✔ Inserted ${inserted} players across ${NATIONS.length} nations`);

  console.log("\nResetting team budgets to £100m…");
  await db.execute(sql`UPDATE teams SET budget = 100, captain_id = NULL, vice_captain_id = NULL`);

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Done. ${inserted} players ready in the player pool.`);
  console.log("═══════════════════════════════════════════════════");
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
