import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const imageQuestions = [
  {
    question: 'Quel peintre est connu pour cette technique du "dripping" ?',
    answer: 'Jackson Pollock',
    points: 2,
    genre: 'Art',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Jackson_Pollock%2C_Number_17A.jpg/1280px-Jackson_Pollock%2C_Number_17A.jpg',
  },
  {
    question: 'Quel est cet instrument traditionnel japonais ?',
    answer: 'Koto',
    points: 2,
    genre: 'Musique',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Koto_player.jpg/1280px-Koto_player.jpg',
  },
  {
    question: 'Quel phénomène naturel est visible sur cette photo ?',
    answer: 'Aurore boréale',
    points: 1,
    genre: 'Sciences',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Polarlicht_2.jpg/1280px-Polarlicht_2.jpg',
  },
  {
    question: 'Quel architecte a conçu cet opéra inauguré en 1973 ?',
    answer: 'Jorn Utzon',
    points: 3,
    genre: 'Architecture',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Sydney_Australia._%2821339175489%29.jpg/1280px-Sydney_Australia._%2821339175489%29.jpg',
  },
  {
    question: 'De quel pays est originaire ce plat appelé "bibimbap" ?',
    answer: 'Corée du Sud',
    points: 1,
    genre: 'Gastronomie',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Dolsot-bibimbap.jpg/1280px-Dolsot-bibimbap.jpg',
  },
  {
    question: 'Quelle espèce de félin est visible sur cette photo ?',
    answer: 'Serval',
    points: 2,
    genre: 'Nature',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Leptailurus_serval_-Serengeti_National_Park%2C_Tanzania-8.jpg/1280px-Leptailurus_serval_-Serengeti_National_Park%2C_Tanzania-8.jpg',
  },
  {
    question: 'Quel mouvement artistique ce tableau de Kandinsky représente-t-il ?',
    answer: 'Art abstrait',
    points: 2,
    genre: 'Art',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Vassily_Kandinsky%2C_1913_-_Composition_7.jpg/1280px-Vassily_Kandinsky%2C_1913_-_Composition_7.jpg',
  },
  {
    question: 'Quel désert est visible sur cette image satellite ?',
    answer: 'Sahara',
    points: 1,
    genre: 'Géographie',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Sahara_satellite_hires.jpg/1280px-Sahara_satellite_hires.jpg',
  },
  {
    question: 'Quel est le nom de cette structure cristalline naturelle ?',
    answer: 'Bismuth',
    points: 3,
    genre: 'Sciences',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bismuth_crystal_macro.jpg/1280px-Bismuth_crystal_macro.jpg',
  },
  {
    question: 'Dans quelle ville se trouve ce quartier surnommé "la petite Venise" ?',
    answer: 'Colmar',
    points: 2,
    genre: 'Géographie',
    type: 'image',
    media_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Colmar_-_Alsace.jpg/1280px-Colmar_-_Alsace.jpg',
  },
];

async function seed() {
  console.log('Insertion de', imageQuestions.length, 'questions image...');

  const { data, error } = await supabase
    .from('questions')
    .insert(imageQuestions)
    .select('id, question, genre');

  if (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }

  console.log('OK, questions insérées :');
  data?.forEach((q) => console.log(`  [${q.genre}] ${q.question}`));
}

seed();
