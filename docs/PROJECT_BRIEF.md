# Barcelona's property finder

The task is to develop map that helps me or other people in Barcelona to buy a property. 
For now the user is just me but the app might be expandable in future publicly. The app should 
help people to create their zone of interest that they may easily export to property finders like Idealista, subscribe
on the updates and get the actual prices. 

The app should work by the following principle:
By default the whole Barcelona area is the area of interest. As soon as we add factors (noise level, transport availability, green areas proximity and so on), the area 
becomes smaller. User can choose depending on his interest: 
1. What is important for him? Is it critical for him to have his workplace within 30min by public transport? Or 20 min by foot? 
2. Does he need to have any other places to be within his area: for instance it is important for him to have at least 1 supermarket within 5 minutes walk by foot. Or it is important to do not have bars near to him?
3. Is it ok for him to live near noisy place?

The resulting area is the target area to be exported to Idealista.

MVP includes interactive map where user see:
- interactive map of Barcelona
- user can eliminate the area by choosing his workplace on the map from which N-min isochrone is built. User should be able to choose the type of isochrone: foot or public transport.
- user can click on the button to see the area on idealista

Stack – React, Maplibre. Database – TBD, Backend – Python (if needed). Other – TBD

No authentication needed for now. Interface is simple.
