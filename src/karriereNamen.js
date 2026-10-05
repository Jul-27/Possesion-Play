/* Namen für die Karriere des Tages — einer, der zur Nation passt.

   Bis zum 05.10.2026 stand dort „Namenlos": Der Tagesstart legte Land, Position und
   Zufall fest, den Namen aber nicht, und wer das Feld leer ließ, spielte als
   Platzhalter. Jetzt kommt auch der Name aus dem Datum — für alle derselbe, wie der
   Rest des Starts.

   Gebräuchliche Vor- und Nachnamen je Land, keine erfundenen Wortschöpfungen. Damit
   aus der Kombination kein echter bekannter Spieler wird („Ben White", „Callum
   Wilson"), prüft ein Test JEDE mögliche Kombination gegen den Spielerbestand; was
   dort als Spieler steht, steht in VERGEBEN und wird übersprungen. */

export const NAMEN = {
  GER: {
    vor: ["Lukas", "Jonas", "Leon", "Felix", "Paul", "Niklas", "Tim", "Moritz", "Jannik", "Fabian", "Tobias", "Simon",
      "Julian", "Florian", "Maximilian", "Johannes", "Philipp", "Benedikt", "Marvin", "Dominik", "Sebastian", "Yannick", "Malte", "Henrik"],
    nach: ["Becker", "Hoffmann", "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann",
      "Braun", "Krüger", "Hartmann", "Lange", "Werner", "Krause", "Köhler", "Maier", "Kaiser", "Fuchs", "Vogel", "Brandt"],
  },
  AUT: {
    vor: ["Lukas", "David", "Florian", "Stefan", "Michael", "Matthias", "Andreas", "Christoph", "Thomas", "Markus", "Patrick", "Daniel",
      "Raphael", "Manuel", "Dominik", "Philipp", "Valentin", "Elias", "Jakob", "Tobias", "Fabian", "Sebastian", "Julian", "Simon"],
    nach: ["Gruber", "Huber", "Wagner", "Pichler", "Steiner", "Moser", "Mayer", "Hofer", "Leitner", "Berger", "Fuchs", "Eder",
      "Fischer", "Schmid", "Winkler", "Weber", "Schwarz", "Maier", "Reiter", "Brunner", "Lang", "Baumgartner", "Auer", "Wallner"],
  },
  ENG: {
    vor: ["Jack", "Harry", "Oliver", "George", "Charlie", "Thomas", "James", "Joshua", "Alfie", "Callum", "Ryan", "Liam",
      "Daniel", "Samuel", "Lewis", "Connor", "Jamie", "Ben", "Luke", "Adam", "Owen", "Joe", "Nathan", "Ethan"],
    nach: ["Smith", "Taylor", "Brown", "Wilson", "Evans", "Walker", "Wright", "Robinson", "Thompson", "White", "Hughes", "Edwards",
      "Green", "Hall", "Wood", "Harris", "Clarke", "Jackson", "Turner", "Hill", "Moore", "Cooper", "Ward", "Baker"],
  },
  ESP: {
    vor: ["Javier", "Pablo", "Alejandro", "Daniel", "Adrián", "Álvaro", "Diego", "Mario", "Sergio", "Hugo", "Iván", "Rubén",
      "Marcos", "Carlos", "Manuel", "Raúl", "Víctor", "Jorge", "Alberto", "Gonzalo", "Andrés", "Íker", "Mateo", "Unai"],
    nach: ["García", "Fernández", "González", "Rodríguez", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Martín", "Jiménez", "Ruiz",
      "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez", "Romero", "Alonso", "Gutiérrez", "Navarro", "Domínguez", "Vázquez", "Serrano"],
  },
  ITA: {
    vor: ["Lorenzo", "Alessandro", "Matteo", "Leonardo", "Francesco", "Andrea", "Gabriele", "Riccardo", "Tommaso", "Davide", "Federico", "Giuseppe",
      "Marco", "Simone", "Luca", "Stefano", "Nicolò", "Pietro", "Emanuele", "Filippo", "Antonio", "Giacomo", "Samuele", "Michele"],
    nach: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo",
      "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Caruso"],
  },
  FRA: {
    vor: ["Lucas", "Hugo", "Théo", "Nathan", "Mathis", "Enzo", "Louis", "Gabriel", "Arthur", "Raphaël", "Jules", "Maxime",
      "Antoine", "Thomas", "Julien", "Nicolas", "Alexandre", "Romain", "Quentin", "Baptiste", "Clément", "Valentin", "Adrien", "Florian"],
    nach: ["Martin", "Bernard", "Dubois", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David",
      "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet", "François"],
  },
  PRT: {
    vor: ["João", "Rodrigo", "Martim", "Tiago", "Duarte", "Gonçalo", "Francisco", "Afonso", "Diogo", "Tomás", "Rafael", "Miguel",
      "Pedro", "André", "Bruno", "Ricardo", "Nuno", "Rui", "Hugo", "Vasco", "Gustavo", "Simão", "Henrique", "Filipe"],
    nach: ["Silva", "Santos", "Ferreira", "Pereira", "Oliveira", "Costa", "Rodrigues", "Martins", "Jesus", "Sousa", "Fernandes", "Gonçalves",
      "Gomes", "Lopes", "Marques", "Alves", "Almeida", "Ribeiro", "Pinto", "Carvalho", "Teixeira", "Moreira", "Correia", "Mendes"],
  },
  NED: {
    vor: ["Daan", "Sem", "Lucas", "Levi", "Finn", "Milan", "Jesse", "Thijs", "Bram", "Ruben", "Stijn", "Jasper",
      "Koen", "Niels", "Sander", "Joris", "Wouter", "Bas", "Tim", "Lars", "Thomas", "Rick", "Jelle", "Mats"],
    nach: ["de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Janssen", "Visser", "Smit", "Meijer", "de Boer", "Mulder",
      "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit", "Dijkstra", "Smits", "de Graaf"],
  },
  BR: {
    vor: ["Gabriel", "Lucas", "Matheus", "Pedro", "Guilherme", "Rafael", "Felipe", "Gustavo", "Thiago", "Bruno", "Vinícius", "Leonardo",
      "Eduardo", "Rodrigo", "Diego", "André", "Caio", "Henrique", "Igor", "Murilo", "Renan", "Wesley", "Everton", "Douglas"],
    nach: ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Ribeiro", "Carvalho",
      "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Cardoso"],
  },
  US: {
    vor: ["Michael", "Christopher", "Matthew", "Joshua", "Andrew", "Ryan", "Tyler", "Brandon", "Jacob", "Austin", "Justin", "Kyle",
      "Zachary", "Dylan", "Cody", "Logan", "Mason", "Caleb", "Hunter", "Aiden", "Jordan", "Cameron", "Garrett", "Bryce"],
    nach: ["Johnson", "Williams", "Miller", "Davis", "Anderson", "Thomas", "Martin", "Jackson", "Thompson", "Moore", "Allen", "Young",
      "King", "Scott", "Adams", "Nelson", "Carter", "Mitchell", "Parker", "Collins", "Stewart", "Morris", "Murphy", "Bennett"],
  },
  SA: {
    vor: ["Abdullah", "Mohammed", "Fahad", "Faisal", "Khalid", "Saud", "Turki", "Nawaf", "Sultan", "Majed", "Hamad", "Bandar",
      "Ali", "Omar", "Yousef", "Ibrahim", "Abdulaziz", "Rakan", "Hassan", "Ziyad", "Mansour", "Nasser", "Saleh", "Riyadh"],
    nach: ["Al-Otaibi", "Al-Harbi", "Al-Qahtani", "Al-Ghamdi", "Al-Zahrani", "Al-Mutairi", "Al-Shammari", "Al-Anazi", "Al-Dosari", "Al-Malki", "Al-Subaie", "Al-Shehri",
      "Al-Juhani", "Al-Rashidi", "Al-Amri", "Al-Asmari", "Al-Yami", "Al-Hamdan", "Al-Khaldi", "Al-Sahli", "Al-Balawi", "Al-Enezi", "Al-Saeed", "Al-Fahad"],
  },
  JP: {
    vor: ["Haruto", "Yuto", "Sota", "Yuki", "Hayato", "Ren", "Riku", "Kaito", "Daiki", "Takumi", "Shota", "Kenta",
      "Ryota", "Kazuki", "Yusuke", "Naoki", "Tatsuya", "Shun", "Hiroki", "Kosuke", "Sho", "Taiga", "Yuma", "Kota"],
    nach: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada",
      "Sasaki", "Yamaguchi", "Matsumoto", "Inoue", "Kimura", "Hayashi", "Shimizu", "Yamazaki", "Mori", "Abe", "Ikeda", "Hashimoto"],
  },
};

/* Kombinationen, die als echter Spieler im Bestand stehen — egal wie bekannt: Auch
   „Charlie Taylor" (Burnley, Bekanntheit 21) soll niemand als Tagesspieler sein.
   Erzeugt und geprüft von karriereNamen.test.js — stimmt die Liste nicht mehr, sagt
   der Test, welche Namen hinzukommen oder wegfallen. */
export const VERGEBEN = new Set([
  "Abdullah Al-Hamdan", "Adam Smith", "Adrián González", "Adrián López", "Adrián Martínez", "Adrián Romero",
  "Adrián Sánchez", "Afonso Alves", "Afonso Martins", "Afonso Moreira", "Alberto Moreno",
  "Alberto Rodríguez", "Alejandro Alonso", "Alessandro Bianchi", "Alessandro Caruso", "Alessandro Romano",
  "Alessandro Rossi", "Álvaro Domínguez", "Álvaro Fernández", "Álvaro González", "Álvaro Rodríguez",
  "Álvaro Vázquez", "André Almeida", "André Carvalho", "André Dias", "André Gomes", "André Marques",
  "André Martins", "André Pereira", "André Santos", "André Silva", "Andrea Bianchi", "Andrea Conti",
  "Andrea Esposito", "Andrea Mancini", "Andrea Romano", "Andrea Rossi", "Andreas Fischer", "Andreas Leitner",
  "Andreas Mayer", "Andreas Winkler", "Andrés Díaz", "Andrés Fernández", "Andrés García", "Andrés González",
  "Andrés Martínez", "Andrew Johnson", "Andrew Mitchell", "Antonio Bianchi", "Antonio Esposito",
  "Antonio Rizzo", "Antonio Romano", "Ben Smith", "Ben White", "Brandon Williams", "Bruno Alves",
  "Bruno Carvalho", "Bruno Costa", "Bruno Fernandes", "Bruno Silva", "Caio Alves", "Caio Ribeiro",
  "Callum Robinson", "Callum Wilson", "Cameron Stewart", "Carlos Álvarez", "Carlos Domínguez",
  "Carlos Fernández", "Carlos García", "Carlos Gutiérrez", "Carlos López", "Carlos Martín",
  "Carlos Martínez", "Carlos Rodríguez", "Carlos Romero", "Carlos Ruiz", "Carlos Sánchez", "Charlie Brown",
  "Charlie Moore", "Charlie Taylor", "Charlie Thompson", "Charlie Walker", "Charlie Wilson",
  "Christoph Baumgartner", "Christopher Scott", "Clément Garcia", "Connor Taylor", "Daniel Alonso",
  "Daniel Muñoz", "Daniel Sánchez", "David Wagner", "Diego Alonso", "Diego Alves", "Diego Gómez",
  "Diego González", "Diego Gutiérrez", "Diego Lopes", "Diego López", "Diego Martínez", "Diego Moreira",
  "Diego Pérez", "Diego Souza", "Diogo Costa", "Diogo Gonçalves", "Dominik Kaiser", "Douglas Santos",
  "Everton Ribeiro", "Everton Santos", "Federico Ricci", "Felipe Lopes", "Filipe Gomes", "Filipe Oliveira",
  "Filipe Teixeira", "Filippo Mancini", "Florian Klein", "Florian Leitner", "Florian Mayer",
  "Francesco Conti", "Francesco Mancini", "Francesco Romano", "Francisco Ferreira", "Francisco Moreira",
  "Francisco Rodrigues", "Gabriel Barbosa", "Gabriel Silva", "George Brown", "George Clarke",
  "George Edwards", "George Evans", "George Green", "George Harris", "George Smith", "George Thompson",
  "George Turner", "George Wilson", "George Wood", "Giuseppe Gallo", "Giuseppe Greco", "Giuseppe Mancini",
  "Giuseppe Marino", "Giuseppe Romano", "Giuseppe Rossi", "Gonçalo Ribeiro", "Gonzalo García",
  "Gonzalo Martínez", "Gonzalo Rodríguez", "Gustavo Teixeira", "Harry Brown", "Harry Clarke", "Harry Hughes",
  "Harry Jackson", "Harry Smith", "Harry Taylor", "Harry Wilson", "Hayato Sasaki", "Hiroki Abe",
  "Hiroki Ito", "Hiroki Yamada", "Hugo Almeida", "Hugo González", "Hugo López", "Hugo Sánchez",
  "Iván Alonso", "Iván González", "Iván Hernández", "Iván López", "Iván Romero", "Iván Sánchez",
  "Jack Clarke", "Jack Hall", "Jack Hill", "Jack Robinson", "Jack Smith", "Jack Taylor", "Jack White",
  "Jack Wilson", "Jacob Murphy", "James Brown", "James Hughes", "James Robinson", "James Smith",
  "James Thompson", "James Wilson", "Jamie Robinson", "Jamie Smith", "Jamie Ward", "Jamie Wood",
  "Javier Hernández", "Javier Pérez", "João Alves", "João Carvalho", "João Correia", "João Costa",
  "João Ferreira", "João Gonçalves", "João Oliveira", "João Pereira", "João Teixeira", "Joe Baker",
  "Joe Cooper", "Joe Edwards", "Joe Harris", "Joe Smith", "Joe Thompson", "Joe Turner", "Joe Ward",
  "Joe White", "Joe Wilson", "Jordan Morris", "Jordan Thompson", "Jorge Jiménez", "Joshua Johnson",
  "Joshua King", "Julian Brandt", "Julian Koch", "Kaito Yamamoto", "Kosuke Nakamura", "Kosuke Yamamoto",
  "Kyle Scott", "Lewis Baker", "Lewis Hall", "Liam Cooper", "Liam Smith", "Lorenzo Colombo", "Lorenzo Gallo",
  "Luca Colombo", "Lucas Lima", "Lucas Silva", "Lukas Krüger", "Luke Moore", "Manuel Fischer",
  "Manuel González", "Manuel Martínez", "Manuel Weber", "Marco Esposito", "Marco Rossi", "Marcos Alonso",
  "Marcos Álvarez", "Marcos López", "Mario Domínguez", "Mario Gómez", "Mario González", "Mario Martín",
  "Mario Ruiz", "Markus Berger", "Markus Reiter", "Martim Fernandes", "Marvin Braun", "Matheus Carvalho",
  "Matheus Fernandes", "Matheus Pereira", "Matteo Ferrari", "Matteo Giordano", "Matteo Ricci",
  "Matthew Scott", "Matthew Williams", "Matthias Schwarz", "Michael Collins", "Michael Johnson",
  "Michael Lang", "Michael Mayer", "Michael Steiner", "Michael Stewart", "Michael Thomas", "Michael Wagner",
  "Miguel Lopes", "Moritz Bauer", "Naoki Yamada", "Nathan Baker", "Nuno Gomes", "Nuno Mendes", "Nuno Santos",
  "Owen Brown", "Pablo Hernández", "Pablo Rodríguez", "Pablo Sánchez", "Patrick Mayer", "Paul Maier",
  "Pedro Barbosa", "Pedro Gonçalves", "Pedro Martins", "Pedro Mendes", "Pedro Moreira", "Pedro Oliveira",
  "Pedro Pereira", "Pedro Rocha", "Pedro Vieira", "Pietro Barbieri", "Pietro Bianchi", "Pietro Ferrari",
  "Pietro Fontana", "Rafael Barbosa", "Rafael Silva", "Raúl García", "Raúl Jiménez", "Ricardo Carvalho",
  "Ricardo Costa", "Ricardo Fernandes", "Ricardo Ferreira", "Ricardo Gomes", "Ricardo Oliveira",
  "Ricardo Pereira", "Ricardo Santos", "Ricardo Sousa", "Rodrigo Fernandes", "Rodrigo Ribeiro",
  "Rubén Navarro", "Rubén Pérez", "Rui Correia", "Rui Costa", "Rui Marques", "Rui Rodrigues", "Rui Silva",
  "Ryan Bennett", "Ryan Green", "Ryan Smith", "Ryan Taylor", "Ryan Thomas", "Ryota Matsumoto",
  "Ryota Suzuki", "Saleh Al-Shehri", "Samuele Ricci", "Sebastian Wolf", "Sergio Díaz", "Sergio Gómez",
  "Sergio Moreno", "Sergio Navarro", "Sergio Rodríguez", "Sergio Romero", "Sergio Sánchez", "Sho Ito",
  "Sho Matsumoto", "Sho Sasaki", "Sho Sato", "Shota Kobayashi", "Simone Esposito", "Stefan Schwarz",
  "Stefano Ferrari", "Stefano Fontana", "Stefano Lombardi", "Stefano Ricci", "Takumi Abe", "Takumi Watanabe",
  "Tatsuya Ito", "Tatsuya Suzuki", "Tatsuya Tanaka", "Thiago Silva", "Thomas Eder", "Thomas Hill",
  "Thomas Mayer", "Thomas Robinson", "Tiago Ferreira", "Tiago Gomes", "Tiago Pereira", "Tiago Pinto",
  "Tiago Rodrigues", "Tiago Santos", "Tim Bauer", "Tim Janssen", "Tobias Werner", "Tomás Costa",
  "Tommaso Barbieri", "Tyler Adams", "Unai Hernández", "Unai López", "Víctor Fernández", "Víctor Gutiérrez",
  "Víctor López", "Víctor Muñoz", "Víctor Ruiz", "Víctor Sánchez", "Víctor Vázquez", "Yuki Abe",
  "Yuki Kobayashi", "Yusuke Mori", "Yusuke Tanaka", "Yuto Sato", "Yuto Suzuki",
]);

/**
 * Ein Name zum Land, aus einem Zufallsgenerator gezogen (für den Tagesstart: aus dem
 * Datum). Steht die Kombination in VERGEBEN, wird weitergezogen. Unbekanntes Land:
 * null — dann bleibt es beim eingetippten Namen.
 */
export function nameFuer(land, zufall) {
  const l = NAMEN[land];
  if (!l) return null;
  for (let versuch = 0; versuch < 50; versuch++) {
    const name = `${l.vor[Math.floor(zufall() * l.vor.length)]} ${l.nach[Math.floor(zufall() * l.nach.length)]}`;
    if (!VERGEBEN.has(name)) return name;
  }
  return null;
}
