UPDATE events SET state='Maharashtra' WHERE state='' AND city IN ('Mumbai','Pune');
UPDATE events SET state='Karnataka' WHERE state='' AND city='Bengaluru';
UPDATE events SET state='Delhi' WHERE state='' AND city IN ('Delhi','New Delhi');
