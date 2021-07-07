const mongoose = require('mongoose');
const cities = require('./cities');
const { places, descriptors } = require('./seedHelpers');
const Offer = require('../models/offer');

mongoose.connect('mongodb://localhost:27017/camp-test', {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useCreateIndex: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
	console.log('Database connected');
});

const sample = (array) => array[Math.floor(Math.random() * array.length)];

const seedDB = async () => {
	await Offer.deleteMany({});
	for (let i = 0; i < 50; i++) {
		const random1000 = Math.floor(Math.random() * 1000);
		const price = Math.floor(Math.random() * 20) + 10;
		const camp = new Offer({
			author: '60b7384015b6d3225c4e7c77',
			location: `${cities[random1000].city}, ${cities[random1000].state}`,
			title: `${sample(descriptors)} ${sample(places)}`,
			description:
				'Lorem ipsum dolor sit amet consectetur adipisicing elit. Ipsa quas, voluptatibus labore molestias, asperiores commodi dignissimos hic ab earum eos sunt laboriosam obcaecati placeat eveniet, praesentium minima repudiandae corporis veritatis.',
			price,
			geometry: {
				type: 'Point',
				coordinates: [ cities[random1000].longitude, cities[random1000].latitude ]
			},
			images: [
				{
					url:
						'https://res.cloudinary.com/diq0t2bqj/image/upload/v1622925764/YelpCamp/kjhxxshjrdudgkoehoyl.jpg',
					filename: 'YelpCamp/kjhxxshjrdudgkoehoyl'
				},
				{
					url:
						'https://res.cloudinary.com/diq0t2bqj/image/upload/v1622925764/YelpCamp/zhvnroyfodtcu1baecfn.jpg',
					filename: 'YelpCamp/zhvnroyfodtcu1baecfn'
				}
			]
		});
		await camp.save();
	}
};

seedDB().then(() => {
	mongoose.connection.close();
});
