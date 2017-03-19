#!/bin/bash
pushd /home/ec2-user/code/japan-nuclear-report > /dev/null
npm run parse
rm -rf data.pdf
popd > /dev/null
