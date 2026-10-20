export const DRIVE_FOLDER_ID = '1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4';
export const DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`;

export function freshData(demo = false) {
  const now = new Date().toISOString();
  const tasks = demo ? [
    ['Find the perfect venue','Venue','in_progress','high','Visit two venues and compare what is included.'],
    ['Create your guest list','Guests','in_progress','high','Start with immediate family and close friends.'],
    ['Choose a photographer','Photography','todo','high','Save your favourite photography styles first.'],
    ['Decide on wedding colours','Decor','done','medium','Build a shared moodboard of favourite colours.'],
    ['Research catering options','Catering','todo','medium','Request menus and pricing.'],
    ['Draft save-the-dates','Stationery','todo','low','Confirm the date before printing.']
  ].map(([title, category, status, priority, notes], i) => ({id:`demo-task-${i}`,title,category,status,priority,notes,assignee:'',dueDate:'',createdAt:now,updatedAt:now})) : [];
  const budget = demo ? [
    ['Venue hire','Venue',28000,0,false],['Photography package','Photography',10500,0,false],
    ['Flowers & decor','Decor',8500,2000,false],['Wedding cake','Catering',3000,0,false]
  ].map(([title, category, estimated, actual, paid],i) => ({id:`demo-budget-${i}`,title,category,estimated,actual,paid,notes:''})) : [];
  const inspiration = demo ? [
    {id:'demo-inspo-1',title:'An intimate candlelit reception',category:'Reception',imageUrl:'https://images.unsplash.com/photo-1519741497674-611481863552?w=1100&q=85',imageId:'',notes:''},
    {id:'demo-inspo-2',title:'Elegant bouquet inspiration',category:'Flowers',imageUrl:'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=1100&q=85',imageId:'',notes:''},
    {id:'demo-inspo-3',title:'The perfect wedding details',category:'Details',imageUrl:'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1100&q=85',imageId:'',notes:''}
  ] : [];
  return {
    version: 1, updatedAt: now,
    settings: {partnerOne:'',partnerTwo:'',weddingDate:'',venue:'',location:'',currency:'TTD',tagline:'A beautiful beginning, together.'},
    tasks, inspiration, budget, guests:[], vendors:[], events:[], planners:[], activity:[]
  };
}

export const starterTasks = [
  ['Set your wedding budget','Planning','high'],['Choose a wedding date','Planning','high'],
  ['Book the ceremony and reception venue','Venue','high'],['Create the first guest list','Guests','high'],
  ['Book your photographer','Photography','high'],['Decide on colours and styling','Decor','medium'],
  ['Research caterers and schedule tastings','Catering','high'],['Choose the wedding party','Planning','medium'],
  ['Shop for wedding attire','Attire','medium'],['Book a florist','Decor','medium'],
  ['Book entertainment or DJ','Entertainment','medium'],['Plan invitations and save-the-dates','Stationery','medium'],
  ['Book hair and makeup','Beauty','medium'],['Arrange transportation','Transport','low'],
  ['Plan the ceremony order','Ceremony','medium'],['Confirm vendor timelines','Planning','medium'],
  ['Finalize the seating plan','Guests','medium'],['Confirm final guest count','Guests','high'],
  ['Prepare final vendor payments','Budget','high'],['Pack everything for the big day','Planning','medium']
];
