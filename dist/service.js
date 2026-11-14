/*
 * Manual maintenance: append a journal name to the matching array.
 * Names that match journals.js automatically receive their cover, homepage and metrics.
 */
window.BAOXUAN_SERVICE = {
  editorial: [
    'Marine Energy Research',
    '《南京理工大学学报》',
    '《盐城工学院学报》',
    '《公路交通科技》'
  ],
  editorialDetails: {
    'Marine Energy Research': {
      homepage: 'https://www.sciepublish.com/journals/mer',
      cover: './assets/journals/marine-energy-research.jpg',
      source: 'https://www.sciepublish.com/journals/mer/indexing',
      cscd: false, pku: false, ei: null
    },
    '《南京理工大学学报》': {
      homepage: 'https://zrxuebao.njust.edu.cn/',
      cover: './assets/journals/njust-editorial.jpg',
      source: 'https://coaa.istic.ac.cn/openjournal/periodical/njlgdxxb',
      cscd: true, pku: true, ei: null
    },
    '《盐城工学院学报》': {
      homepage: 'https://ygzk.ycit.cn/',
      cover: './assets/journals/ycit-editorial.jpg',
      source: 'https://xueb.ycit.edu.cn/zrkxb/tgzn.htm',
      cscd: null, pku: null, ei: null
    },
    '《公路交通科技》': {
      homepage: 'https://www.gljtkj.com/CN/1002-0268/home.shtml',
      cover: './assets/journals/highway-transportation.jpg',
      source: 'https://www.cqvip.com/journal/91479X/detail',
      cscd: true, pku: true, ei: null
    }
  },
  reviewers: [
    'Renewable and Sustainable Energy Reviews',
    'Energy',
    'Thin-Walled Structures',
    'Energy Conversion and Management: X',
    'Composite Structures',
    'Sustainable Energy Technologies and Assessments',
    'Ocean Engineering',
    'Journal of Offshore Mechanics and Arctic Engineering',
    'Structures',
    'Soil Dynamics and Earthquake Engineering',
    'Wind Energy and Engineering Research',
    'SoftwareX',
    'Applied Ocean Research',
    'Aerospace Science and Technology',
    'Cold Regions Science and Technology',
    'Measurement',
    'Journal of Wind Engineering and Industrial Aerodynamics',
    'Materials & Design',
    'Marine Structures',
    'Scientific Reports',
    'Next Mechanical Engineering'
  ]
};
